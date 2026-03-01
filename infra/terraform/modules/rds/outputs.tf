output "database_url" {
  description = "Database connection string for API/worker."
  value       = local.database_url
  sensitive   = true
}

output "address" {
  description = "RDS endpoint address."
  value       = aws_db_instance.main.address
}

output "port" {
  description = "RDS port."
  value       = aws_db_instance.main.port
}

