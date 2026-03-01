output "app_secret_arn" {
  description = "ARN of the JSON secret containing runtime configuration."
  value       = aws_secretsmanager_secret.app.arn
}

