output "bucket_id" {
  description = "S3 bucket name (id) for analysis report bundles."
  value       = aws_s3_bucket.analysis_reports.id
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = aws_s3_bucket.analysis_reports.arn
}
