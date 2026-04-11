variable "zone_name" {
  type        = string
  description = "Public DNS zone name (e.g. badgers.nl). Must match the apex you delegate at your registrar."
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]+\\.[a-z]{2,}$", var.zone_name))
    error_message = "zone_name must be a valid DNS apex hostname."
  }
}

variable "comment" {
  type        = string
  description = "Hosted zone comment (AWS console)."
  default     = "Managed by Terraform (Badgers Investments prod)"
}

variable "force_destroy" {
  type        = bool
  description = "Allow delete when non-default records exist (use with care)."
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Tags for the hosted zone."
  default     = {}
}
