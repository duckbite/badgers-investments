resource "random_password" "cookie_secret" {
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
    API_DATABASE_URL = var.database_url
    COOKIE_SECRET    = random_password.cookie_secret.result
  })
}

