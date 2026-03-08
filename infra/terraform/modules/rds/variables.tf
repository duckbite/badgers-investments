variable "name_prefix" {
  type        = string
  description = "Prefix used for naming resources."
}

variable "vpc_id" {
  type        = string
  description = "VPC ID."
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for the RDS subnet group."
}

variable "db_security_group_id" {
  type        = string
  description = "Security group ID to attach to the RDS instance."
}

variable "engine_major_version" {
  type        = string
  description = "Postgres major version (e.g. 16)."
  validation {
    condition     = can(regex("^\\d+$", var.engine_major_version))
    error_message = "engine_major_version must be a number-like string (e.g. \"16\")."
  }
}

variable "engine_version_override" {
  type        = string
  description = "Optional full engine version override (e.g. 16.13). Leave empty to use latest for the major version."
  default     = ""
  validation {
    condition     = var.engine_version_override == "" || can(regex("^\\d+\\.\\d+(\\.\\d+)?$", var.engine_version_override))
    error_message = "engine_version_override must be empty or look like a semantic version string."
  }
}

variable "instance_class" {
  type        = string
  description = "RDS instance class."
}

variable "allocated_storage_gb" {
  type        = number
  description = "Allocated storage in GB."
}

variable "backup_retention_days" {
  type        = number
  description = "Backup retention period in days."
  validation {
    condition     = var.backup_retention_days >= 0 && var.backup_retention_days <= 35
    error_message = "backup_retention_days must be between 0 and 35."
  }
}

variable "max_allocated_storage_gb" {
  type        = number
  description = "Maximum allocated storage in GB."
}

variable "backup_window" {
  type        = string
  description = "Preferred backup window (UTC) in format HH:MM-HH:MM."
}

variable "maintenance_window" {
  type        = string
  description = "Preferred maintenance window (UTC) in format ddd:HH:MM-ddd:HH:MM."
}

variable "deletion_protection" {
  type        = bool
  description = "Enable deletion protection."
}

variable "skip_final_snapshot" {
  type        = bool
  description = "Skip final snapshot on deletion."
}

variable "apply_immediately" {
  type        = bool
  description = "Apply modifications immediately."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all resources."
}

