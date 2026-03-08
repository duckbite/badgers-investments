output "oidc_provider_arn" {
  description = "OIDC provider ARN for GitHub Actions."
  value       = aws_iam_openid_connect_provider.github_actions.arn
}

output "deploy_role_arn" {
  description = "IAM role ARN to assume from GitHub Actions via OIDC."
  value       = aws_iam_role.deploy.arn
}

