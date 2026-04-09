output "web_url" {
  description = "Web URL."
  value       = "https://${var.web_domain}"
}

output "web_bucket_name" {
  description = "S3 bucket name that stores the web build output."
  value       = aws_s3_bucket.web.bucket
}

output "web_bucket_arn" {
  description = "S3 bucket ARN that stores the web build output."
  value       = aws_s3_bucket.web.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN."
  value       = aws_cloudfront_distribution.web.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "dns_records_to_create" {
  description = "DNS records that must exist for ACM validation / aliasing when Route53 is not managed."
  value = {
    certificate_validation = local.web_certificate_validation_records
    web_alias = {
      name                     = var.web_domain
      type_a_target_name       = aws_cloudfront_distribution.web.domain_name
      type_a_target_zone_id    = aws_cloudfront_distribution.web.hosted_zone_id
      type_aaaa_target_name    = aws_cloudfront_distribution.web.domain_name
      type_aaaa_target_zone_id = aws_cloudfront_distribution.web.hosted_zone_id
    }
  }
}

