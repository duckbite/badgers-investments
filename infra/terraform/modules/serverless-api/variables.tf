variable "name_prefix" {
  type        = string
  description = "Name prefix for resources."
}

variable "api_domain" {
  type        = string
  description = "Public API domain."
}

variable "route53_zone_id" {
  type        = string
  description = "Route53 Hosted Zone ID for public records."
  default     = ""
}

variable "manage_dns_records" {
  type        = bool
  description = "If true, create ACM validation + alias records in the given zone. Must be a constant so Terraform can plan for_each."
  default     = false
}

variable "dynamodb_table_name" {
  type        = string
  description = "DynamoDB table name for application storage."
}

variable "dynamodb_table_arn" {
  type        = string
  description = "DynamoDB table ARN for application storage."
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources."
  default     = {}
}

