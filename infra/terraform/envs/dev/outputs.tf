output "app_dynamodb_table_name" {
  description = "Application DynamoDB table name (dev)."
  value       = module.app_dynamodb.table_name
}

output "app_dynamodb_table_arn" {
  description = "Application DynamoDB table ARN (dev)."
  value       = module.app_dynamodb.table_arn
}

output "analysis_reports_bucket_id" {
  description = "S3 bucket name for dev analysis report bundles; set API_REPORTS_BUCKET_NAME to this value for local API."
  value       = module.analysis_reports_bucket.bucket_id
}

output "analysis_reports_bucket_arn" {
  description = "S3 bucket ARN for dev analysis reports (IAM policies)."
  value       = module.analysis_reports_bucket.bucket_arn
}
