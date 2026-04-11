output "bucket_id" {
  description = "S3 bucket name for static web assets."
  value       = aws_s3_bucket.web.id
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = aws_s3_bucket.web.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (invalidations)."
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN (IAM)."
  value       = aws_cloudfront_distribution.web.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront domain (*.cloudfront.net)."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "acm_validation_records" {
  description = "DNS records for ACM certificate (us-east-1) when Terraform creates the web cert (not imported ARNs)."
  value = local.use_imported_web_tls ? [] : [
    for dvo in flatten(aws_acm_certificate.web[*].domain_validation_options) : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ]
}
