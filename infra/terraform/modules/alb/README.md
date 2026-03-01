## Module: alb

Creates:

- Application Load Balancer
- Target groups for `web` and `api`
- HTTP→HTTPS redirect listener
- ACM certificate (DNS validation)
- Optional Route53 records for validation + domain aliases (if `route53_zone_id` is provided)

