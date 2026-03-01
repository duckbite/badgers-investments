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

variable "db_engine_version" {
  type        = string
  description = "Postgres engine version."
  default     = "16.3"
  validation {
    condition     = can(regex("^\\d+\\.\\d+(\\.\\d+)?$", var.db_engine_version))
    error_message = "db_engine_version must look like a semantic version string (e.g. 16.3)."
  }
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class."
  default     = "db.t4g.micro"
  validation {
    condition     = length(trimspace(var.db_instance_class)) > 0
    error_message = "db_instance_class must be a non-empty string."
  }
}

variable "db_allocated_storage" {
  type        = number
  description = "Allocated storage in GB."
  default     = 20
  validation {
    condition     = var.db_allocated_storage >= 20
    error_message = "db_allocated_storage must be at least 20 GB."
  }
}

variable "db_backup_retention_days" {
  type        = number
  description = "Backup retention period in days."
  default     = 7
  validation {
    condition     = var.db_backup_retention_days >= 0 && var.db_backup_retention_days <= 35
    error_message = "db_backup_retention_days must be between 0 and 35."
  }
}

variable "db_max_allocated_storage" {
  type        = number
  description = "Maximum storage in GB for autoscaling."
  default     = 100
  validation {
    condition     = var.db_max_allocated_storage >= var.db_allocated_storage
    error_message = "db_max_allocated_storage must be >= db_allocated_storage."
  }
}

variable "db_backup_window" {
  type        = string
  description = "Preferred backup window (UTC) in format HH:MM-HH:MM."
  default     = "03:00-04:00"
  validation {
    condition     = can(regex("^\\d{2}:\\d{2}-\\d{2}:\\d{2}$", var.db_backup_window))
    error_message = "db_backup_window must be in format HH:MM-HH:MM."
  }
}

variable "db_maintenance_window" {
  type        = string
  description = "Preferred maintenance window (UTC) in format ddd:HH:MM-ddd:HH:MM."
  default     = "sun:04:00-sun:05:00"
  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):\\d{2}:\\d{2}-(mon|tue|wed|thu|fri|sat|sun):\\d{2}:\\d{2}$", var.db_maintenance_window))
    error_message = "db_maintenance_window must be in format ddd:HH:MM-ddd:HH:MM."
  }
}

variable "db_deletion_protection" {
  type        = bool
  description = "Enable RDS deletion protection."
  default     = true
}

variable "db_skip_final_snapshot" {
  type        = bool
  description = "Skip final snapshot on deletion (not recommended for real prod)."
  default     = false
}

variable "db_apply_immediately" {
  type        = bool
  description = "Apply RDS modifications immediately."
  default     = true
}

