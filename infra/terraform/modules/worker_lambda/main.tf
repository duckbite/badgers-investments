data "archive_file" "bootstrap" {
  type = "zip"
  source {
    content  = <<-EOT
      export const handler = async () => {
        console.log("Worker placeholder — deploy bundle via CI.");
        return { ok: true };
      };
    EOT
    filename = "index.mjs"
  }
  output_path = "${path.module}/.terraform-bootstrap-worker.zip"
}

locals {
  daily_worker_name             = "${var.name_prefix}-daily-worker"
  recommendation_processor_name = "${var.name_prefix}-recommendation-processor"
  recommendation_dlq_name       = "${var.name_prefix}-recommendation-dlq"
  recommendation_queue_name     = "${var.name_prefix}-recommendation-queue"
}

resource "aws_cloudwatch_log_group" "daily_worker" {
  name              = "/aws/lambda/${local.daily_worker_name}"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "recommendation_processor" {
  name              = "/aws/lambda/${local.recommendation_processor_name}"
  retention_in_days = 14
  tags              = var.tags
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "daily_worker" {
  name               = "${local.daily_worker_name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "daily_worker_basic" {
  role       = aws_iam_role.daily_worker.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role" "recommendation_processor" {
  name               = "${local.recommendation_processor_name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "recommendation_processor_basic" {
  role       = aws_iam_role.recommendation_processor.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_sqs_queue" "recommendation_dlq" {
  name                       = local.recommendation_dlq_name
  message_retention_seconds  = 1209600
  visibility_timeout_seconds = var.recommendation_queue_visibility_timeout_seconds
  tags                       = var.tags
}

resource "aws_sqs_queue" "recommendation_queue" {
  name                       = local.recommendation_queue_name
  message_retention_seconds  = 1209600
  visibility_timeout_seconds = var.recommendation_queue_visibility_timeout_seconds
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.recommendation_dlq.arn
    maxReceiveCount     = var.recommendation_queue_max_receive_count
  })
  tags = var.tags
}

data "aws_iam_policy_document" "recommendation_processor_access" {
  statement {
    sid    = "RecommendationQueueRead"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [aws_sqs_queue.recommendation_queue.arn]
  }

  statement {
    sid    = "RecommendationDynamoAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [
      var.dynamodb_table_arn,
      "${var.dynamodb_table_arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "recommendation_processor_access" {
  name   = "${local.recommendation_processor_name}-access"
  role   = aws_iam_role.recommendation_processor.id
  policy = data.aws_iam_policy_document.recommendation_processor_access.json
}

resource "aws_lambda_function" "daily_worker" {
  function_name    = local.daily_worker_name
  role             = aws_iam_role.daily_worker.arn
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 256
  publish          = true
  tags             = var.tags

  environment {
    variables = {
      AWS_NODEJS_DISABLE_COLORS = "1"
    }
  }

  depends_on = [aws_cloudwatch_log_group.daily_worker]

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}

resource "aws_lambda_function" "recommendation_processor" {
  function_name    = local.recommendation_processor_name
  role             = aws_iam_role.recommendation_processor.arn
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = var.recommendation_processor_timeout_seconds
  memory_size      = 512
  publish          = true
  tags             = var.tags

  environment {
    variables = {
      AWS_NODEJS_DISABLE_COLORS          = "1"
      API_DYNAMODB_REGION                = var.aws_region
      API_DYNAMODB_TABLE_NAME            = var.dynamodb_table_name
      API_AI_SETTINGS_SECRET             = var.api_ai_settings_secret
      RECOMMENDATION_JOB_QUEUE_MODE      = "SQS"
      RECOMMENDATION_PROCESSOR_QUEUE_URL = aws_sqs_queue.recommendation_queue.url
    }
  }

  depends_on = [aws_cloudwatch_log_group.recommendation_processor]

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}

resource "aws_lambda_event_source_mapping" "recommendation_queue" {
  event_source_arn                   = aws_sqs_queue.recommendation_queue.arn
  function_name                      = aws_lambda_function.recommendation_processor.arn
  batch_size                         = 1
  maximum_batching_window_in_seconds = 0
  enabled                            = true

  scaling_config {
    maximum_concurrency = var.recommendation_processor_max_concurrency
  }
}

resource "aws_cloudwatch_event_rule" "daily_worker_schedule" {
  name                = "${var.name_prefix}-daily-worker-schedule"
  description         = "Invoke daily worker on fixed schedule."
  schedule_expression = "rate(1 day)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "daily_worker" {
  rule      = aws_cloudwatch_event_rule.daily_worker_schedule.name
  target_id = "lambda"
  arn       = aws_lambda_function.daily_worker.arn
}

resource "aws_lambda_permission" "daily_worker_events" {
  statement_id  = "AllowEventsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.daily_worker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_worker_schedule.arn
}

resource "aws_cloudwatch_metric_alarm" "recommendation_queue_oldest_age" {
  alarm_name          = "${var.name_prefix}-recommendation-queue-oldest-age"
  alarm_description   = "Recommendation queue backlog age exceeded threshold."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = var.recommendation_queue_age_alarm_threshold_seconds
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions
  dimensions = {
    QueueName = aws_sqs_queue.recommendation_queue.name
  }
  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "recommendation_dlq_visible_messages" {
  alarm_name          = "${var.name_prefix}-recommendation-dlq-visible"
  alarm_description   = "Recommendation DLQ has visible messages."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions
  dimensions = {
    QueueName = aws_sqs_queue.recommendation_dlq.name
  }
  tags = var.tags
}
