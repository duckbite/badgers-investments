locals {
  domains        = [var.web_domain, var.api_domain]
  manage_route53 = length(trimspace(var.route53_zone_id)) > 0
}

resource "aws_lb" "main" {
  name               = "${var.name_prefix}-alb"
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids
  tags               = merge(var.tags, { Name = "${var.name_prefix}-alb" })
}

resource "aws_lb_target_group" "web" {
  name        = "${var.name_prefix}-web-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 20
    timeout             = 5
    matcher             = "200-399"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-web-tg" })
}

resource "aws_lb_target_group" "api" {
  name        = "${var.name_prefix}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 20
    timeout             = 5
    matcher             = "200-399"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-api-tg" })
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_acm_certificate" "main" {
  domain_name               = var.web_domain
  subject_alternative_names = [var.api_domain]
  validation_method         = "DNS"
  tags                      = merge(var.tags, { Name = "${var.name_prefix}-cert" })
}

locals {
  certificate_validation_records = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = local.manage_route53 ? local.certificate_validation_records : {}

  allow_overwrite = true
  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "main" {
  count                   = local.manage_route53 ? 1 : 0
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.manage_route53 ? aws_acm_certificate_validation.main[0].certificate_arn : aws_acm_certificate.main.arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

resource "aws_route53_record" "web_alias_a" {
  count   = local.manage_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.web_domain
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_alias_aaaa" {
  count   = local.manage_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.web_domain
  type    = "AAAA"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_alias_a" {
  count   = local.manage_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.api_domain
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_alias_aaaa" {
  count   = local.manage_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.api_domain
  type    = "AAAA"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = false
  }
}

