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

module "analysis_reports_bucket" {
  source      = "../../modules/analysis_reports_bucket"
  name_prefix = "${var.project_name}-${var.environment}"
  tags        = merge(local.tags, { Purpose = "analysis-reports" })
}
