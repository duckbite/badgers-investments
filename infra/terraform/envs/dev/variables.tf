variable "aws_region" {
  type        = string
  description = "AWS region for the dev DynamoDB table."
  validation {
    condition     = length(trimspace(var.aws_region)) > 0
    error_message = "aws_region must be a non-empty string."
  }
}

variable "project_name" {
  type        = string
  description = "Project name used for tagging."
  default     = "badgers-investments"
}

variable "environment" {
  type        = string
  description = "Environment label for tagging."
  default     = "dev"
}

variable "app_dynamodb_table_name" {
  type        = string
  description = "Name of the dev application DynamoDB table."
  default     = "badgers-investments-dev"
}

variable "app_dynamodb_pitr_enabled" {
  type        = bool
  description = "Enable point-in-time recovery on the dev table."
  default     = false
}
