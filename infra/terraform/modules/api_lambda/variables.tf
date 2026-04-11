variable "name_prefix" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "aws_region" {
  type = string
}

variable "api_domain" {
  type = string
}

variable "cors_allow_origin" {
  type        = string
  description = "Origin allowed for CORS (e.g. https://app.example.com). Empty skips CORS plugin."
  default     = ""
}

variable "route53_zone_id" {
  type        = string
  description = "Hosted zone ID for validation/alias records (may be unknown at plan when creating a new zone)."
  default     = ""
}

variable "manage_dns_records" {
  type        = bool
  description = "When true, manage ACM validation + API custom-domain aliases in Route53. Set explicitly from root so for_each does not depend on unknown zone_id."
  default     = true
}

variable "api_tls_certificate_arn" {
  type        = string
  description = "ISSUED regional ACM ARN for api_domain. Use when route53_zone_id is empty (with manual DNS to API Gateway)."
  default     = ""
}

variable "dynamodb_table_name" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "secrets_arn" {
  type = string
}
