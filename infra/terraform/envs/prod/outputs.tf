output "web_url" {
  description = "Web URL."
  value       = "https://${var.web_domain}"
}

output "api_url" {
  description = "API URL."
  value       = "https://${var.api_domain}"
}

output "web_s3_bucket_id" {
  description = "S3 bucket for static web assets (GitHub Actions sync)."
  value       = module.static_site.bucket_id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation."
  value       = module.static_site.cloudfront_distribution_id
}

output "lambda_api_function_name" {
  description = "API Lambda function name for update-function-code."
  value       = module.api_lambda.function_name
}

output "lambda_worker_function_name" {
  description = "Worker Lambda function name for update-function-code."
  value       = module.worker_lambda.function_name
}

output "github_actions_deploy_role_arn" {
  description = "IAM role ARN to assume from GitHub Actions via OIDC for production deploys."
  value       = module.github_actions_oidc.deploy_role_arn
}

output "static_site_acm_validation_records" {
  description = "ACM DNS validation for CloudFront cert (us-east-1) when Route53 is not managed in Terraform."
  value       = module.static_site.acm_validation_records
}

output "api_lambda_id" {
  description = "HTTP API id (debug)."
  value       = module.api_lambda.api_gateway_id
}
