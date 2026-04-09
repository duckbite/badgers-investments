variable "name_prefix" {
  type        = string
  description = "Name prefix for IAM resources."
}

variable "github_org" {
  type        = string
  description = "GitHub organization/user that owns the repo (e.g. duckbite)."
}

variable "github_repo" {
  type        = string
  description = "GitHub repo name (e.g. badgers-investments)."
}

variable "github_ref" {
  type        = string
  description = "Git ref constraint for the OIDC subject claim (e.g. refs/heads/main)."
  default     = "refs/heads/main"
}

variable "web_s3_bucket_arn" {
  type        = string
  description = "ARN of the static web S3 bucket (object sync + list)."
}

variable "cloudfront_distribution_arn" {
  type        = string
  description = "CloudFront distribution ARN for cache invalidation."
}

variable "lambda_api_function_arn" {
  type        = string
  description = "API Lambda function ARN (UpdateFunctionCode)."
}

variable "lambda_worker_function_arn" {
  type        = string
  description = "Worker Lambda function ARN (UpdateFunctionCode)."
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to IAM resources."
  default     = {}
}

variable "grant_terraform_apply_permissions" {
  type        = bool
  description = "When true, attach AdministratorAccess so this role can run terraform apply in GitHub Actions (state + full stack). Prefer a dedicated ops account; narrow policies are possible but high-maintenance."
  default     = false
}
