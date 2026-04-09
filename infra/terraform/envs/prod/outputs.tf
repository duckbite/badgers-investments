output "route53_zone_id" {
  description = "Public hosted zone ID for badgers.nl (create or reuse)."
  value       = local.route53_zone_effective_id
}

output "route53_delegation_nameservers" {
  description = "Four nameserver hostnames — set these at your registrar for badgers.nl (delegation uses names, not IP addresses)."
  value       = var.route53_zone_id != "" ? one(data.aws_route53_zone.existing[*].name_servers) : one(aws_route53_zone.badgers_nl[*].name_servers)
}

output "web_url" {
  description = "Web URL."
  value       = module.web.web_url
}

output "api_url" {
  description = "API URL."
  value       = module.api.api_url
}

output "dns_records_to_create" {
  description = "DNS records that must exist for ACM validation / aliasing when Route53 is not managed."
  value = {
    web = module.web.dns_records_to_create
    api = module.api.dns_records_to_create
  }
}

output "github_actions_deploy_role_arn" {
  description = "IAM role ARN to assume from GitHub Actions via OIDC for production deploys."
  value       = module.github_actions_oidc.deploy_role_arn
}

output "web_bucket_name" {
  description = "S3 bucket name containing static web assets."
  value       = module.web.web_bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the web frontend."
  value       = module.web.cloudfront_distribution_id
}

output "api_lambda_function_name" {
  description = "Lambda function name for the API."
  value       = module.api.lambda_function_name
}

output "dynamodb_table_name" {
  description = "DynamoDB table name for application data."
  value       = module.dynamodb.table_name
}

