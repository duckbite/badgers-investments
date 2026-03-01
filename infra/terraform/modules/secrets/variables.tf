variable "name_prefix" {
  type        = string
  description = "Prefix used for naming resources."
}

variable "database_url" {
  type        = string
  description = "Database connection string to store as a secret."
  sensitive   = true
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all resources."
}

