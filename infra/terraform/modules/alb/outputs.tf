output "alb_dns_name" {
  description = "ALB DNS name."
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB canonical hosted zone ID."
  value       = aws_lb.main.zone_id
}

output "https_listener_arn" {
  description = "HTTPS listener ARN."
  value       = aws_lb_listener.https.arn
}

output "web_target_group_arn" {
  description = "Target group ARN for web."
  value       = aws_lb_target_group.web.arn
}

output "api_target_group_arn" {
  description = "Target group ARN for api."
  value       = aws_lb_target_group.api.arn
}

output "dns_records_to_create" {
  description = "DNS records to create manually when Route53 is not managed."
  value = {
    certificate_validation = local.certificate_validation_records
    alb_alias_targets = {
      web = { name = var.web_domain, target = aws_lb.main.dns_name }
      api = { name = var.api_domain, target = aws_lb.main.dns_name }
    }
  }
}

