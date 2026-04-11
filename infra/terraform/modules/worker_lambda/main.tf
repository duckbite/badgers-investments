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

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${var.name_prefix}-worker"
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

resource "aws_iam_role" "worker" {
  name               = "${var.name_prefix}-worker-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "worker_basic" {
  role       = aws_iam_role.worker.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "worker" {
  function_name    = "${var.name_prefix}-worker"
  role             = aws_iam_role.worker.arn
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

  depends_on = [aws_cloudwatch_log_group.worker]

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}

resource "aws_cloudwatch_event_rule" "worker_schedule" {
  name                = "${var.name_prefix}-worker-daily"
  description         = "Invoke worker on a fixed schedule (placeholder)."
  schedule_expression = "rate(1 day)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "worker" {
  rule      = aws_cloudwatch_event_rule.worker_schedule.name
  target_id = "lambda"
  arn       = aws_lambda_function.worker.arn
}

resource "aws_lambda_permission" "events" {
  statement_id  = "AllowEventsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.worker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.worker_schedule.arn
}
