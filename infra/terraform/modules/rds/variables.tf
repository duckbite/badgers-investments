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

variable "engine_version" {
  type        = string
  description = "Postgres engine version."
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

