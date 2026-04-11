variable "name_prefix" {
  type        = string
  description = "Prefix for resource names."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to resources."
  default     = {}
}

variable "web_domain" {
  type        = string
  description = "FQDN for the static site."
}

variable "route53_zone_id" {
  type        = string
  description = "Hosted zone ID for validation + aliases (may be unknown at plan for a newly created zone)."
  default     = ""
}

variable "manage_dns_records" {
  type        = bool
  description = "When true, manage ACM validation + CloudFront aliases in Route53."
  default     = true
}

variable "web_tls_certificate_arn" {
  type        = string
  description = "ISSUED ACM certificate ARN in us-east-1 for CloudFront. Required when route53_zone_id is empty (with api TLS handled in api_lambda)."
  default     = ""
}

variable "web_bucket_force_destroy" {
  type        = bool
  description = "Allow empty-and-delete web bucket on terraform destroy (recommended for deploy-artifact buckets)."
  default     = true
}
