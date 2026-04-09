locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

module "dynamodb" {
  source                        = "../../modules/dynamodb"
  name_prefix                   = local.name_prefix
  enable_point_in_time_recovery = var.dynamodb_enable_point_in_time_recovery
  tags                          = local.tags
}

module "web" {
  source               = "../../modules/serverless-web"
  name_prefix          = local.name_prefix
  web_domain           = var.web_domain
  route53_zone_id      = local.route53_zone_effective_id
  manage_dns_records   = true
  tags                 = local.tags

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

module "api" {
  source               = "../../modules/serverless-api"
  name_prefix          = local.name_prefix
  api_domain           = var.api_domain
  route53_zone_id      = local.route53_zone_effective_id
  manage_dns_records   = true
  dynamodb_table_name  = module.dynamodb.table_name
  dynamodb_table_arn   = module.dynamodb.table_arn
  tags                 = local.tags
}

module "github_actions_oidc" {
  source                      = "../../modules/github-actions-oidc-serverless"
  name_prefix                 = local.name_prefix
  github_org                  = var.github_org
  github_repo                 = var.github_repo
  github_ref                  = var.github_ref
  web_bucket_arn              = module.web.web_bucket_arn
  lambda_function_arn         = module.api.lambda_function_arn
  cloudfront_distribution_arn = module.web.cloudfront_distribution_arn
  tags                        = local.tags
}

