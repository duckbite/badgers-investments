output "zone_id" {
  description = "Route53 hosted zone ID (pass to modules that manage records under this zone)."
  value       = aws_route53_zone.this.zone_id
}

output "name_servers" {
  description = "Delegation NS records — set these at your domain registrar for this apex."
  value       = aws_route53_zone.this.name_servers
}

output "zone_arn" {
  value = aws_route53_zone.this.arn
}

output "name" {
  value = aws_route53_zone.this.name
}
