output "state_bucket_name" {
  description = "S3 bucket name for Terraform remote state."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "state_lock_table_name" {
  description = "DynamoDB table name for Terraform state locking."
  value       = aws_dynamodb_table.terraform_state_lock.name
}

output "state_key" {
  description = "Object key used for the production Terraform state."
  value       = local.state_object_key
}

output "aws_region" {
  description = "AWS region used for backend resources."
  value       = var.aws_region
}

