## Module: network

Creates the baseline VPC networking for production:

- VPC with public/private subnets across 2 AZs
- Internet Gateway + NAT Gateway
- Security groups for ALB, ECS tasks, and RDS

### Inputs

- `name_prefix`
- `aws_region`
- `vpc_cidr`
- `public_subnet_cidrs`
- `private_subnet_cidrs`
- `tags`

### Outputs

- `vpc_id`
- `public_subnet_ids`
- `private_subnet_ids`
- `alb_security_group_id`
- `ecs_security_group_id`
- `db_security_group_id`

