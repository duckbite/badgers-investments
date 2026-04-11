variable "aws_region" {
  type        = string
  description = "AWS region for production infrastructure."
  validation {
    condition     = length(trimspace(var.aws_region)) > 0
    error_message = "aws_region must be a non-empty string."
  }
}

variable "project_name" {
  type        = string
  description = "Project name used for tagging and naming."
  default     = "badgers-investments"
}

variable "environment" {
  type        = string
  description = "Environment name."
  default     = "prod"
}

variable "web_domain" {
  type        = string
  description = "Public web domain."
  default     = "investments.badgers.nl"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]+\\.[a-z]{2,}$", var.web_domain))
    error_message = "web_domain must be a valid DNS hostname."
  }
}

variable "api_domain" {
  type        = string
  description = "Public API domain."
  default     = "api.investments.badgers.nl"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]+\\.[a-z]{2,}$", var.api_domain))
    error_message = "api_domain must be a valid DNS hostname."
  }
}

variable "dns_zone_name" {
  type        = string
  description = "Route53 public hosted zone apex Terraform creates (e.g. badgers.nl). Delegate this zone at your registrar using output route53_name_servers."
  default     = "badgers.nl"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]+\\.[a-z]{2,}$", var.dns_zone_name))
    error_message = "dns_zone_name must be a valid DNS apex (e.g. badgers.nl)."
  }
}

variable "dynamodb_table_name" {
  type        = string
  description = "DynamoDB application table name. Prod Terraform creates this table (PK/SK + GSI1) with PITR and deletion protection."
  validation {
    condition     = length(trimspace(var.dynamodb_table_name)) > 0
    error_message = "dynamodb_table_name must be non-empty."
  }
}

variable "app_dynamodb_deletion_protection" {
  type        = bool
  description = "When true (default), the application DynamoDB table cannot be deleted until this is set false and applied."
  default     = true
}

variable "github_org" {
  type        = string
  description = "GitHub org/user for OIDC trust policy."
  default     = "duckbite"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name for OIDC trust policy."
  default     = "badgers-investments"
}

variable "github_ref" {
  type        = string
  description = "Git ref for production deploys (used in OIDC subject claim)."
  default     = "refs/heads/main"
}

variable "github_actions_grant_terraform_apply" {
  type        = bool
  description = "Attach AdministratorAccess to the GitHub OIDC deploy role so CI can terraform apply. Apply once with elevated credentials, then enable; see README."
  default     = false
}
