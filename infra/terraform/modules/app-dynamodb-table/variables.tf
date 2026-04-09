variable "table_name" {
  type        = string
  description = "DynamoDB table name for application data."
  validation {
    condition     = length(trimspace(var.table_name)) > 0
    error_message = "table_name must be non-empty."
  }
}

variable "hash_key_name" {
  type        = string
  description = "Partition key attribute name (string). Must match production (`PK`) for single-table access patterns."
  default     = "PK"
}

variable "range_key_name" {
  type        = string
  description = "Sort key attribute name (string). Must match production (`SK`) for single-table access patterns."
  default     = "SK"
}

variable "gsi1_enabled" {
  type        = bool
  description = "When true, creates global secondary index GSI1 (GSI1PK / GSI1SK), matching the production table layout."
  default     = true
}

variable "gsi1_name" {
  type        = string
  description = "Name of the first GSI (when gsi1_enabled)."
  default     = "GSI1"
}

variable "gsi1_hash_key_name" {
  type        = string
  description = "GSI1 partition key attribute name."
  default     = "GSI1PK"
}

variable "gsi1_range_key_name" {
  type        = string
  description = "GSI1 sort key attribute name."
  default     = "GSI1SK"
}

variable "gsi1_projection_type" {
  type        = string
  description = "Projection type for GSI1."
  default     = "ALL"
}

variable "point_in_time_recovery_enabled" {
  type        = bool
  description = "Enable DynamoDB PITR (recommended for production-like data)."
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the table."
  default     = {}
}
