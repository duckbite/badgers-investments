variable "name_prefix" {
  type        = string
  description = "Name prefix for resources."
}

variable "web_domain" {
  type        = string
  description = "Public web domain."
}

variable "route53_zone_id" {
  type        = string
  description = "Route53 Hosted Zone ID for public records."
  default     = ""
}

variable "manage_dns_records" {
  type        = bool
  description = "If true, create ACM validation + alias records in the given zone. Must be a constant (not derived from computed zone_id) so Terraform can plan for_each."
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources."
  default     = {}
}

