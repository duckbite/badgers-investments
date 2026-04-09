# Public zone for badgers.nl: either created here (route53_zone_id unset) or existing zone ID.
resource "aws_route53_zone" "badgers_nl" {
  count = var.route53_zone_id == "" ? 1 : 0
  name  = "badgers.nl"
  tags  = merge(local.tags, { Name = "badgers-nl-public" })
}

data "aws_route53_zone" "existing" {
  count   = var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
}

locals {
  route53_zone_effective_id = coalesce(
    var.route53_zone_id != "" ? var.route53_zone_id : null,
    try(aws_route53_zone.badgers_nl[0].zone_id, null)
  )
}

# Migrated from legacy DNS (dns_records.json). Does not include investments / api.investments — those
# are managed by serverless web + API modules (CloudFront + API Gateway aliases).
resource "aws_route53_record" "apex_mx" {
  zone_id = local.route53_zone_effective_id
  name    = "badgers.nl"
  type    = "MX"
  ttl     = 3600
  records = ["10 mail.badgers.nl"]
}

resource "aws_route53_record" "apex_a" {
  zone_id = local.route53_zone_effective_id
  name    = "badgers.nl"
  type    = "A"
  ttl     = 3600
  records = ["95.211.60.7"]
}

resource "aws_route53_record" "www_a" {
  zone_id = local.route53_zone_effective_id
  name    = "www.badgers.nl"
  type    = "A"
  ttl     = 3600
  records = ["95.211.60.7"]
}

resource "aws_route53_record" "mail_a" {
  zone_id = local.route53_zone_effective_id
  name    = "mail.badgers.nl"
  type    = "A"
  ttl     = 3600
  records = ["95.211.60.7"]
}

resource "aws_route53_record" "ftp_a" {
  zone_id = local.route53_zone_effective_id
  name    = "ftp.badgers.nl"
  type    = "A"
  ttl     = 3600
  records = ["95.211.60.7"]
}

resource "aws_route53_record" "pop_a" {
  zone_id = local.route53_zone_effective_id
  name    = "pop.badgers.nl"
  type    = "A"
  ttl     = 3600
  records = ["95.211.60.7"]
}

resource "aws_route53_record" "smtp_a" {
  zone_id = local.route53_zone_effective_id
  name    = "smtp.badgers.nl"
  type    = "A"
  ttl     = 3600
  records = ["95.211.60.7"]
}

resource "aws_route53_record" "wildcard_a" {
  zone_id = local.route53_zone_effective_id
  name    = "*.badgers.nl"
  type    = "A"
  ttl     = 3600
  records = ["95.211.60.7"]
}
