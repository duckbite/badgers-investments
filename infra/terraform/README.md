## Terraform (AWS production)

This folder contains Terraform infrastructure-as-code for deploying Badgers Investments to AWS (ECS Fargate + RDS + ALB + ACM + Secrets Manager + CloudWatch Logs).

### Layout

- `bootstrap/`: Creates the **S3 remote state bucket** and **DynamoDB lock table**.
- `envs/prod/`: Production stack that provisions networking, ECR, RDS, ALB/ACM/DNS and ECS.
- `modules/`: Reusable Terraform modules (network, ecr, rds, secrets, alb, ecs).

### Running (single command)

From repo root:

```bash
cp infra/terraform/envs/prod/terraform.tfvars.example infra/terraform/envs/prod/terraform.tfvars
pnpm prod:up
```

### Formatting / validation / linting

```bash
pnpm infra:fmt
pnpm infra:validate
pnpm infra:tflint
```

