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

variable "ecr_repository_arns" {
  type        = list(string)
  description = "ECR repository ARNs that CI is allowed to push/pull."
}

variable "ecs_execution_role_arn" {
  type        = string
  description = "ECS task execution role ARN (for iam:PassRole)."
}

variable "ecs_task_role_arn" {
  type        = string
  description = "ECS task role ARN (for iam:PassRole)."
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to IAM resources."
  default     = {}
}

