variable "name_prefix" {
  type        = string
  description = "Name prefix for DynamoDB table."
}

variable "enable_point_in_time_recovery" {
  type        = bool
  description = "Enable DynamoDB Point-in-Time Recovery (PITR)."
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources."
  default     = {}
}

