locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
  dns_zone_name_trimmed = trimspace(var.dns_zone_name)
  hostnames_under_zone = (
    (var.web_domain == local.dns_zone_name_trimmed || endswith(var.web_domain, ".${local.dns_zone_name_trimmed}")) &&
    (var.api_domain == local.dns_zone_name_trimmed || endswith(var.api_domain, ".${local.dns_zone_name_trimmed}"))
  )
}

module "public_dns_zone" {
  source    = "../../modules/public_dns_zone"
  zone_name = local.dns_zone_name_trimmed
  tags      = merge(local.tags, { Name = "${var.project_name}-${var.environment}-dns" })
}

module "secrets" {
  source      = "../../modules/secrets"
  name_prefix = "${var.project_name}-${var.environment}"
  tags        = local.tags
}

module "app_dynamodb" {
  source                         = "../../modules/app-dynamodb-table"
  table_name                     = var.dynamodb_table_name
  tags                           = merge(local.tags, { Name = "${var.project_name}-${var.environment}-ddb" })
  point_in_time_recovery_enabled = true
  deletion_protection_enabled    = var.app_dynamodb_deletion_protection
}

module "static_site" {
  source = "../../modules/static_site"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
  name_prefix              = "${var.project_name}-${var.environment}"
  tags                     = local.tags
  web_domain               = var.web_domain
  route53_zone_id          = module.public_dns_zone.zone_id
  manage_dns_records       = true
  web_bucket_force_destroy = true
}

module "api_lambda" {
  source              = "../../modules/api_lambda"
  name_prefix         = "${var.project_name}-${var.environment}"
  tags                = local.tags
  aws_region          = var.aws_region
  api_domain          = var.api_domain
  cors_allow_origin   = "https://${var.web_domain}"
  route53_zone_id     = module.public_dns_zone.zone_id
  manage_dns_records  = true
  dynamodb_table_name = module.app_dynamodb.table_name
  dynamodb_table_arn  = module.app_dynamodb.table_arn
  secrets_arn         = module.secrets.app_secret_arn
}

module "worker_lambda" {
  source      = "../../modules/worker_lambda"
  name_prefix = "${var.project_name}-${var.environment}"
  tags        = local.tags
}

module "github_actions_oidc" {
  source = "../../modules/github-actions-oidc"

  name_prefix                       = "${var.project_name}-${var.environment}"
  github_org                        = var.github_org
  github_repo                       = var.github_repo
  github_ref                        = var.github_ref
  web_s3_bucket_arn                 = module.static_site.bucket_arn
  cloudfront_distribution_arn       = module.static_site.cloudfront_distribution_arn
  lambda_api_function_arn           = module.api_lambda.function_arn
  lambda_worker_function_arn        = module.worker_lambda.function_arn
  grant_terraform_apply_permissions = var.github_actions_grant_terraform_apply
  tags                              = local.tags
}
