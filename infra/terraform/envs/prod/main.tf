data "aws_caller_identity" "current" {}

locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
  dynamodb_table_arn = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_table_name}"
}

module "secrets" {
  source      = "../../modules/secrets"
  name_prefix = "${var.project_name}-${var.environment}"
  tags        = local.tags
}

module "static_site" {
  source = "../../modules/static_site"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
  name_prefix     = "${var.project_name}-${var.environment}"
  tags            = local.tags
  web_domain      = var.web_domain
  route53_zone_id = var.route53_zone_id
}

module "api_lambda" {
  source              = "../../modules/api_lambda"
  name_prefix         = "${var.project_name}-${var.environment}"
  tags                = local.tags
  aws_region          = var.aws_region
  api_domain          = var.api_domain
  cors_allow_origin   = "https://${var.web_domain}"
  route53_zone_id     = var.route53_zone_id
  dynamodb_table_name = var.dynamodb_table_name
  dynamodb_table_arn  = local.dynamodb_table_arn
  secrets_arn         = module.secrets.app_secret_arn
}

module "worker_lambda" {
  source      = "../../modules/worker_lambda"
  name_prefix = "${var.project_name}-${var.environment}"
  tags        = local.tags
}

module "github_actions_oidc" {
  source = "../../modules/github-actions-oidc"

  name_prefix    = "${var.project_name}-${var.environment}"
  github_org     = var.github_org
  github_repo    = var.github_repo
  github_ref     = var.github_ref
  web_s3_bucket_arn          = module.static_site.bucket_arn
  cloudfront_distribution_arn = module.static_site.cloudfront_distribution_arn
  lambda_api_function_arn    = module.api_lambda.function_arn
  lambda_worker_function_arn = module.worker_lambda.function_arn
  tags                       = local.tags
}
