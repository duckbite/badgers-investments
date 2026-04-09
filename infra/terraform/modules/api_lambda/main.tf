locals {
  manage_route53 = length(trimspace(var.route53_zone_id)) > 0
}

data "archive_file" "bootstrap" {
  type = "zip"
  source {
    content = <<-EOT
      export const handler = async () => ({
        statusCode: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Placeholder — deploy Lambda code via CI (pnpm build:lambda / update-function-code)." }),
      });
    EOT
    filename = "index.mjs"
  }
  output_path = "${path.module}/.terraform-bootstrap-api.zip"
}

data "aws_secretsmanager_secret_version" "app" {
  secret_id = var.secrets_arn
}

locals {
  app_secrets = jsondecode(data.aws_secretsmanager_secret_version.app.secret_string)
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.name_prefix}-api"
  retention_in_days = 30
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

resource "aws_iam_role" "api" {
  name               = "${var.name_prefix}-api-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "api_basic" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "api_task" {
  statement {
    sid     = "DynamoDBAppTable"
    effect  = "Allow"
    actions = ["dynamodb:DescribeTable", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"]
    resources = [
      var.dynamodb_table_arn,
      "${var.dynamodb_table_arn}/index/*",
    ]
  }
  statement {
    sid       = "SecretsRead"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [var.secrets_arn]
  }
}

resource "aws_iam_role_policy" "api" {
  name   = "${var.name_prefix}-api-lambda-inline"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api_task.json
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.name_prefix}-api"
  role             = aws_iam_role.api.arn
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 512
  publish          = true
  tags             = var.tags

  environment {
    variables = {
      API_DYNAMODB_TABLE_NAME = var.dynamodb_table_name
      API_DYNAMODB_REGION     = var.aws_region
      AWS_NODEJS_DISABLE_COLORS = "1"
      COOKIE_SECRET            = local.app_secrets["COOKIE_SECRET"]
      CORS_ORIGIN              = var.cors_allow_origin
    }
  }

  depends_on = [aws_cloudwatch_log_group.api]

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.name_prefix}-api"
  protocol_type = "HTTP"
  tags          = var.tags
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_acm_certificate" "api" {
  domain_name       = var.api_domain
  validation_method = "DNS"
  tags              = merge(var.tags, { Name = "${var.name_prefix}-api-cert" })
  lifecycle {
    create_before_destroy = true
  }
}

locals {
  api_cert_validation = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = local.manage_route53 ? local.api_cert_validation : {}

  allow_overwrite = true
  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "api" {
  count           = local.manage_route53 ? 1 : 0
  certificate_arn = aws_acm_certificate.api.arn
  validation_record_fqdns = [
    for record in aws_route53_record.api_cert_validation : record.fqdn
  ]
}

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = var.api_domain
  domain_name_configuration {
    certificate_arn = local.manage_route53 ? aws_acm_certificate_validation.api[0].certificate_arn : aws_acm_certificate.api.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
  tags = var.tags
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.prod.id
}

resource "aws_route53_record" "api_alias_a" {
  count   = local.manage_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.api_domain
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_alias_aaaa" {
  count   = local.manage_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.api_domain
  type    = "AAAA"
  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
