variable "name_prefix" {
  type        = string
  description = "Prefix used for naming resources."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all resources."
}
