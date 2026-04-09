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
  type    = string
  default = ""
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
