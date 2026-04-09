output "alb_dns_name" {
  description = "DNS name of the production ALB."
  value       = module.alb.alb_dns_name
}

output "web_url" {
  description = "Web URL."
  value       = "https://${var.web_domain}"
}

output "api_url" {
  description = "API URL."
  value       = "https://${var.api_domain}"
}

output "dns_records_to_create" {
  description = "DNS records that must exist for ACM validation / aliasing when Route53 is not managed."
  value       = module.alb.dns_records_to_create
}

output "web_ecr_repository_url" {
  description = "ECR repository URL for web."
  value       = module.ecr.web_repository_url
}

output "api_ecr_repository_url" {
  description = "ECR repository URL for api."
  value       = module.ecr.api_repository_url
}

output "worker_ecr_repository_url" {
  description = "ECR repository URL for worker."
  value       = module.ecr.worker_repository_url
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN."
  value       = module.ecs.ecs_cluster_arn
}

output "private_subnet_ids_csv" {
  description = "Private subnet IDs as a comma-separated list."
  value       = join(",", module.network.private_subnet_ids)
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS tasks."
  value       = module.network.ecs_security_group_id
}

output "api_task_definition_arn" {
  description = "Task definition ARN for API."
  value       = module.ecs.api_task_definition_arn
}

output "github_actions_deploy_role_arn" {
  description = "IAM role ARN to assume from GitHub Actions via OIDC for production deploys."
  value       = module.github_actions_oidc.deploy_role_arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs.ecs_cluster_name
}

output "ecs_api_service_name" {
  description = "ECS service name for API."
  value       = module.ecs.api_service_name
}

output "ecs_web_service_name" {
  description = "ECS service name for web."
  value       = module.ecs.web_service_name
}

