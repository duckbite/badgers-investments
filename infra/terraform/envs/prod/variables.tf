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

variable "route53_zone_id" {
  type        = string
  description = "Route53 Hosted Zone ID for badgers.nl. If empty, DNS records are not managed and outputs must be applied manually."
  default     = ""
  validation {
    condition     = var.route53_zone_id == "" || can(regex("^Z[A-Z0-9]+$", var.route53_zone_id))
    error_message = "route53_zone_id must be empty or look like a Route53 Hosted Zone ID (e.g. Z123...)."
  }
}

variable "enable_services" {
  type        = bool
  description = "When false, provisions shared infrastructure but does not create ECS services/task definitions that require built images."
  default     = false
}

variable "web_image_tag" {
  type        = string
  description = "Docker image tag for the web service in ECR."
  default     = "bootstrap"
}

variable "api_image_tag" {
  type        = string
  description = "Docker image tag for the API service in ECR."
  default     = "bootstrap"
}

variable "worker_image_tag" {
  type        = string
  description = "Docker image tag for the worker task in ECR."
  default     = "bootstrap"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block."
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDR blocks."
  default     = ["10.0.0.0/20", "10.0.16.0/20"]
  validation {
    condition     = alltrue([for c in var.public_subnet_cidrs : can(cidrnetmask(c))])
    error_message = "public_subnet_cidrs must contain only valid CIDR blocks."
  }
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDR blocks."
  default     = ["10.0.128.0/20", "10.0.144.0/20"]
  validation {
    condition     = alltrue([for c in var.private_subnet_cidrs : can(cidrnetmask(c))])
    error_message = "private_subnet_cidrs must contain only valid CIDR blocks."
  }
}

variable "availability_zone_count" {
  type        = number
  description = "Number of availability zones to use (must match subnet CIDR list sizes)."
  default     = 2
  validation {
    condition     = var.availability_zone_count >= 2 && var.availability_zone_count <= 3
    error_message = "availability_zone_count must be between 2 and 3."
  }
  validation {
    condition     = length(var.public_subnet_cidrs) == var.availability_zone_count
    error_message = "public_subnet_cidrs length must equal availability_zone_count."
  }
  validation {
    condition     = length(var.private_subnet_cidrs) == var.availability_zone_count
    error_message = "private_subnet_cidrs length must equal availability_zone_count."
  }
}

variable "dynamodb_table_name" {
  type        = string
  description = "DynamoDB table name for application data (must exist; Terraform does not create it here)."
  validation {
    condition     = length(trimspace(var.dynamodb_table_name)) > 0
    error_message = "dynamodb_table_name must be non-empty."
  }
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

