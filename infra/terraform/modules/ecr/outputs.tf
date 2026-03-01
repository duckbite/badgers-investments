output "web_repository_url" {
  description = "Web ECR repository URL."
  value       = aws_ecr_repository.repos["web"].repository_url
}

output "api_repository_url" {
  description = "API ECR repository URL."
  value       = aws_ecr_repository.repos["api"].repository_url
}

output "worker_repository_url" {
  description = "Worker ECR repository URL."
  value       = aws_ecr_repository.repos["worker"].repository_url
}

