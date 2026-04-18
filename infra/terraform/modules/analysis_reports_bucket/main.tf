# Private bucket for Explore / Library analysis report bundles (markdown, manifest, assets).
# See ADR-013; runtime reads `API_REPORTS_BUCKET_NAME` (services/api).

resource "aws_s3_bucket" "analysis_reports" {
  bucket = "${var.name_prefix}-analysis-reports"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-analysis-reports" })
}

resource "aws_s3_bucket_public_access_block" "analysis_reports" {
  bucket                  = aws_s3_bucket.analysis_reports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "analysis_reports" {
  bucket = aws_s3_bucket.analysis_reports.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
