variable "name_prefix" {
  type        = string
  description = "Prefix used for naming resources."
}

variable "vpc_id" {
  type        = string
  description = "VPC ID."
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for ECS tasks."
}

variable "ecs_security_group_id" {
  type        = string
  description = "Security group ID for ECS tasks."
}

variable "alb_listener_https_arn" {
  type        = string
  description = "HTTPS listener ARN for the ALB."
}

variable "web_domain" {
  type        = string
  description = "Web domain for host-based routing."
}

variable "api_domain" {
  type        = string
  description = "API domain for host-based routing."
}

variable "web_target_group_arn" {
  type        = string
  description = "Target group ARN for the web service."
}

variable "api_target_group_arn" {
  type        = string
  description = "Target group ARN for the api service."
}

variable "web_ecr_repository_url" {
  type        = string
  description = "ECR repository URL for web."
}

variable "api_ecr_repository_url" {
  type        = string
  description = "ECR repository URL for api."
}

variable "worker_ecr_repository_url" {
  type        = string
  description = "ECR repository URL for worker."
}

variable "secrets_arn" {
  type        = string
  description = "Secrets Manager secret ARN containing JSON configuration."
}

variable "aws_region" {
  type        = string
  description = "AWS region (injected as API_DYNAMODB_REGION for tasks)."
}

variable "dynamodb_table_name" {
  type        = string
  description = "DynamoDB table name for application data."
}

variable "dynamodb_table_arn" {
  type        = string
  description = "DynamoDB table ARN for IAM policy (include account/region)."
}

variable "web_image_tag" {
  type        = string
  description = "Docker image tag for web."
}

variable "api_image_tag" {
  type        = string
  description = "Docker image tag for api."
}

variable "worker_image_tag" {
  type        = string
  description = "Docker image tag for worker."
}

variable "enable_services" {
  type        = bool
  description = "Enable ECS services and task definitions that require images."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all resources."
}

