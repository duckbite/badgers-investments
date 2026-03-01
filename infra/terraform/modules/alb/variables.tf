variable "name_prefix" {
  type        = string
  description = "Prefix used for naming resources."
}

variable "vpc_id" {
  type        = string
  description = "VPC ID."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs for the ALB."
}

variable "alb_security_group_id" {
  type        = string
  description = "Security group ID attached to the ALB."
}

variable "web_domain" {
  type        = string
  description = "Web domain name."
}

variable "api_domain" {
  type        = string
  description = "API domain name."
}

variable "route53_zone_id" {
  type        = string
  description = "Route53 zone ID. When empty, Route53 records are not managed."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all resources."
}

