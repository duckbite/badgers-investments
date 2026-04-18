variable "name_prefix" {
  type        = string
  description = "Prefix for the bucket name (e.g. badgers-investments-dev)."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the bucket."
  default     = {}
}
