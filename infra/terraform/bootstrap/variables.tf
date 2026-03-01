variable "aws_region" {
  type        = string
  description = "AWS region to create the Terraform state backend resources in."
}

variable "project_name" {
  type        = string
  description = "Project name used for naming state backend resources."
  default     = "badgers-investments"
}

