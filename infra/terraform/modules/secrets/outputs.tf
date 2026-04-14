output "app_secret_arn" {
  description = "ARN of the JSON secret containing runtime configuration."
  value       = aws_secretsmanager_secret.app.arn
}

output "cookie_secret" {
  description = "COOKIE_SECRET string (same as stored in Secrets Manager JSON)."
  value       = random_password.cookie_secret.result
  sensitive   = true
}

output "api_ai_settings_secret" {
  description = "API_AI_SETTINGS_SECRET string (same as stored in Secrets Manager JSON)."
  value       = random_password.ai_settings_secret.result
  sensitive   = true
}

output "api_privacy_secret" {
  description = "API_PRIVACY_SECRET string (same as stored in Secrets Manager JSON)."
  value       = random_password.privacy_secret.result
  sensitive   = true
}
