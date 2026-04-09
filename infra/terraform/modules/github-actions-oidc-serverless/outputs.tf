output "deploy_role_arn" {
  description = "IAM role ARN to assume from GitHub Actions via OIDC for production deploys."
  value       = aws_iam_role.deploy.arn
}

