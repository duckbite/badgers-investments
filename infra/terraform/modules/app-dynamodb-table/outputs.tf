output "table_name" {
  description = "DynamoDB table name."
  value       = aws_dynamodb_table.app.name
}

output "table_arn" {
  description = "DynamoDB table ARN."
  value       = aws_dynamodb_table.app.arn
}

output "table_id" {
  description = "DynamoDB table ID."
  value       = aws_dynamodb_table.app.id
}
