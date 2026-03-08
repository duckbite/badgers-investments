output "web_repository_url" {
  description = "Web ECR repository URL."
  value       = aws_ecr_repository.repos["web"].repository_url
}

output "web_repository_arn" {
  description = "Web ECR repository ARN."
  value       = aws_ecr_repository.repos["web"].arn
}

output "api_repository_url" {
  description = "API ECR repository URL."
  value       = aws_ecr_repository.repos["api"].repository_url
}

output "api_repository_arn" {
  description = "API ECR repository ARN."
  value       = aws_ecr_repository.repos["api"].arn
}

output "worker_repository_url" {
  description = "Worker ECR repository URL."
  value       = aws_ecr_repository.repos["worker"].repository_url
}

output "worker_repository_arn" {
  description = "Worker ECR repository ARN."
  value       = aws_ecr_repository.repos["worker"].arn
}

