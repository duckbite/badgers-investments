output "app_dynamodb_table_name" {
  description = "Application DynamoDB table (Terraform-managed; deletion protected in prod)."
  value       = module.app_dynamodb.table_name
}

output "app_dynamodb_table_arn" {
  description = "Application DynamoDB table ARN."
  value       = module.app_dynamodb.table_arn
}

output "web_url" {
  description = "Web URL."
  value       = "https://${var.web_domain}"
}

output "api_url" {
  description = "API URL (custom domain or default execute-api URL)."
  value       = module.api_lambda.public_api_url
}

output "web_s3_bucket_id" {
  description = "S3 bucket for static web assets (GitHub Actions sync)."
  value       = module.static_site.bucket_id
}

output "analysis_reports_bucket_id" {
  description = "S3 bucket name for production analysis report bundles (API Lambda API_REPORTS_BUCKET_NAME)."
  value       = module.analysis_reports_bucket.bucket_id
}

output "analysis_reports_bucket_arn" {
  description = "S3 bucket ARN for production analysis reports."
  value       = module.analysis_reports_bucket.bucket_arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation."
  value       = module.static_site.cloudfront_distribution_id
}

output "lambda_api_function_name" {
  description = "API Lambda function name for update-function-code."
  value       = module.api_lambda.function_name
}

output "lambda_daily_worker_function_name" {
  description = "Daily worker Lambda function name for update-function-code."
  value       = module.worker_lambda.daily_worker_function_name
}

output "lambda_recommendation_processor_function_name" {
  description = "Recommendation processor Lambda function name for update-function-code."
  value       = module.worker_lambda.recommendation_processor_function_name
}

output "recommendation_queue_url" {
  description = "Recommendation processor SQS queue URL."
  value       = module.worker_lambda.recommendation_queue_url
}

output "github_actions_deploy_role_arn" {
  description = "IAM role ARN to assume from GitHub Actions via OIDC for production deploys."
  value       = module.github_actions_oidc.deploy_role_arn
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID (Terraform-managed apex)."
  value       = module.public_dns_zone.zone_id
}

output "route53_name_servers" {
  description = "NS records for dns_zone_name — configure at your registrar to delegate DNS to Route53."
  value       = module.public_dns_zone.name_servers
}

output "static_site_acm_validation_records" {
  description = "ACM DNS validation records for CloudFront (us-east-1); empty when Route53 manages validation (normal prod)."
  value       = module.static_site.acm_validation_records
}

output "api_lambda_id" {
  description = "HTTP API id (debug)."
  value       = module.api_lambda.api_gateway_id
}
