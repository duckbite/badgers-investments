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
  description = "Route53 hosted zone ID; empty skips managed DNS validation completion (manual certs)."
  default     = ""
}
