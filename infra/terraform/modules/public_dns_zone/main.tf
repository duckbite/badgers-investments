resource "aws_route53_zone" "this" {
  name          = var.zone_name
  force_destroy = var.force_destroy
  comment       = var.comment
  tags          = var.tags
}
