locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "application-data"
  }
}

module "app_dynamodb" {
  source                         = "../../modules/app-dynamodb-table"
  table_name                     = var.app_dynamodb_table_name
  tags                           = local.tags
  point_in_time_recovery_enabled = var.app_dynamodb_pitr_enabled
}
