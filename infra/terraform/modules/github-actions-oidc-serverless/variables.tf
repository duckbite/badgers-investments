variable "name_prefix" {
  type        = string
  description = "Name prefix for IAM resources."
}

variable "github_org" {
  type        = string
  description = "GitHub org/user for OIDC trust policy."
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name for OIDC trust policy."
}

variable "github_ref" {
  type        = string
  description = "Git ref for production deploys (used in OIDC subject claim)."
}

variable "web_bucket_arn" {
  type        = string
  description = "ARN of the S3 bucket containing the web build."
}

variable "lambda_function_arn" {
  type        = string
  description = "ARN of the API Lambda function to update."
}

variable "cloudfront_distribution_arn" {
  type        = string
  description = "ARN of the CloudFront distribution to invalidate."
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources."
  default     = {}
}

