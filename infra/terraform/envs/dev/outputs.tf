output "app_dynamodb_table_name" {
  description = "Application DynamoDB table name (dev)."
  value       = module.app_dynamodb.table_name
}

output "app_dynamodb_table_arn" {
  description = "Application DynamoDB table ARN (dev)."
  value       = module.app_dynamodb.table_arn
}
