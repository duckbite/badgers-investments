resource "aws_dynamodb_table" "app" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = var.hash_key_name
  range_key    = var.range_key_name

  attribute {
    name = var.hash_key_name
    type = "S"
  }

  attribute {
    name = var.range_key_name
    type = "S"
  }

  dynamic "attribute" {
    for_each = var.gsi1_enabled ? [1] : []
    content {
      name = var.gsi1_hash_key_name
      type = "S"
    }
  }

  dynamic "attribute" {
    for_each = var.gsi1_enabled ? [1] : []
    content {
      name = var.gsi1_range_key_name
      type = "S"
    }
  }

  dynamic "global_secondary_index" {
    for_each = var.gsi1_enabled ? [1] : []
    content {
      name            = var.gsi1_name
      hash_key        = var.gsi1_hash_key_name
      range_key       = var.gsi1_range_key_name
      projection_type = var.gsi1_projection_type
    }
  }

  point_in_time_recovery {
    enabled = var.point_in_time_recovery_enabled
  }

  deletion_protection_enabled = var.deletion_protection_enabled

  tags = var.tags
}
