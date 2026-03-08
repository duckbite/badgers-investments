output "ecs_cluster_arn" {
  description = "ECS cluster ARN."
  value       = aws_ecs_cluster.main.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.main.name
}

output "api_task_definition_arn" {
  description = "API task definition ARN."
  value       = var.enable_services ? aws_ecs_task_definition.api[0].arn : ""
}

output "api_service_name" {
  description = "API service name."
  value       = var.enable_services ? aws_ecs_service.api[0].name : ""
}

output "web_service_name" {
  description = "Web service name."
  value       = var.enable_services ? aws_ecs_service.web[0].name : ""
}

output "execution_role_arn" {
  description = "ECS task execution role ARN."
  value       = aws_iam_role.execution.arn
}

output "task_role_arn" {
  description = "ECS task role ARN."
  value       = aws_iam_role.task.arn
}

