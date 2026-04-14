resource "random_password" "cookie_secret" {
  length           = 48
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "ai_settings_secret" {
  length           = 48
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "privacy_secret" {
  length           = 48
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "app" {
  name = "${var.name_prefix}-app-secrets"
  tags = merge(var.tags, { Name = "${var.name_prefix}-app-secrets" })
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    COOKIE_SECRET          = random_password.cookie_secret.result
    API_AI_SETTINGS_SECRET = random_password.ai_settings_secret.result
    API_PRIVACY_SECRET     = random_password.privacy_secret.result
  })
}
