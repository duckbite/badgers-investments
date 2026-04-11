locals {
  manage_route53       = var.manage_dns_records
  use_imported_web_tls = !var.manage_dns_records && length(trimspace(var.web_tls_certificate_arn)) > 0
}

# CloudFront requires either forwarded_values (legacy) or cache_policy_id on each behavior.
# `Managed-CachingImmutable` is not present in all accounts' managed policy lists; use CachingOptimized for both paths.
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "cors_s3_origin" {
  name = "Managed-CORS-S3Origin"
}

resource "aws_s3_bucket" "web" {
  bucket        = "${var.name_prefix}-web-static"
  force_destroy = var.web_bucket_force_destroy
  tags          = merge(var.tags, { Name = "${var.name_prefix}-web-static" })
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.name_prefix}-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "web" {
  count             = local.use_imported_web_tls ? 0 : 1
  provider          = aws.us_east_1
  domain_name       = var.web_domain
  validation_method = "DNS"
  tags              = merge(var.tags, { Name = "${var.name_prefix}-web-cert" })
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "web_cert_validation" {
  for_each = local.manage_route53 && !local.use_imported_web_tls ? { acm = true } : {}

  allow_overwrite = true
  zone_id         = var.route53_zone_id
  name            = one([for dvo in aws_acm_certificate.web[0].domain_validation_options : dvo.resource_record_name])
  type            = one([for dvo in aws_acm_certificate.web[0].domain_validation_options : dvo.resource_record_type])
  ttl             = 60
  records         = [one([for dvo in aws_acm_certificate.web[0].domain_validation_options : dvo.resource_record_value])]
}

resource "aws_acm_certificate_validation" "web" {
  provider        = aws.us_east_1
  count           = local.manage_route53 && !local.use_imported_web_tls ? 1 : 0
  certificate_arn = one(aws_acm_certificate.web[*].arn)
  validation_record_fqdns = [
    aws_route53_record.web_cert_validation["acm"].fqdn,
  ]
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name_prefix} web"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = [var.web_domain]
  tags                = merge(var.tags, { Name = "${var.name_prefix}-web-cf" })

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "s3-web"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3_origin.id
  }

  ordered_cache_behavior {
    path_pattern             = "/_app/immutable/*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "s3-web"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3_origin.id
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = local.use_imported_web_tls ? var.web_tls_certificate_arn : (
      local.manage_route53 ? aws_acm_certificate_validation.web[0].certificate_arn : one(aws_acm_certificate.web[*].arn)
    )
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

data "aws_iam_policy_document" "web_bucket" {
  statement {
    sid    = "AllowCloudFrontRead"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket     = aws_s3_bucket.web.id
  policy     = data.aws_iam_policy_document.web_bucket.json
  depends_on = [aws_cloudfront_distribution.web]
}

resource "aws_route53_record" "web_alias_a" {
  count   = local.manage_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.web_domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_alias_aaaa" {
  count   = local.manage_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.web_domain
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}
