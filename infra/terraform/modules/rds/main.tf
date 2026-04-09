resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

data "aws_rds_engine_version" "postgres" {
  engine  = "postgres"
  version = var.engine_major_version
  latest  = true
}

locals {
  db_name                 = "badgers_investments"
  db_username             = "badgers"
  resolved_engine_version = var.engine_version_override == "" ? data.aws_rds_engine_version.postgres.version : var.engine_version_override
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Name = "${var.name_prefix}-db-subnets" })
}

resource "aws_db_instance" "main" {
  identifier            = "${var.name_prefix}-postgres"
  engine                = "postgres"
  engine_version        = local.resolved_engine_version
  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = local.db_name
  username = local.db_username
  password = random_password.db_password.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.db_security_group_id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = var.backup_retention_days
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window

  deletion_protection = var.deletion_protection
  skip_final_snapshot = var.skip_final_snapshot

  apply_immediately = var.apply_immediately

  tags = merge(var.tags, { Name = "${var.name_prefix}-postgres" })
}

locals {
  database_url = "postgresql://${local.db_username}:${random_password.db_password.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${local.db_name}?schema=public"
}

