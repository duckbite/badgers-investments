output "ecs_cluster_arn" {
  description = "ECS cluster ARN."
  value       = aws_ecs_cluster.main.arn
}

output "api_task_definition_arn" {
  description = "API task definition ARN."
  value       = var.enable_services ? aws_ecs_task_definition.api[0].arn : ""
}

