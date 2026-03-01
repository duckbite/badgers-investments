variable "name_prefix" {
  type        = string
  description = "Prefix used for naming resources."
}

variable "aws_region" {
  type        = string
  description = "AWS region (used for availability zone selection)."
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block."
  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDR blocks."
  validation {
    condition     = alltrue([for c in var.public_subnet_cidrs : can(cidrnetmask(c))])
    error_message = "public_subnet_cidrs must contain only valid CIDR blocks."
  }
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDR blocks."
  validation {
    condition     = alltrue([for c in var.private_subnet_cidrs : can(cidrnetmask(c))])
    error_message = "private_subnet_cidrs must contain only valid CIDR blocks."
  }
}

variable "availability_zone_count" {
  type        = number
  description = "Number of availability zones to use (must match subnet CIDR list sizes)."
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

variable "tags" {
  type        = map(string)
  description = "Tags applied to all resources."
}

