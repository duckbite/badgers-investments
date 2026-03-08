## Terraform (AWS production)

This folder contains Terraform infrastructure-as-code for deploying Badgers Investments to AWS (ECS Fargate + RDS + ALB + ACM + Secrets Manager + CloudWatch Logs).

### Layout

- `bootstrap/`: Creates the **S3 remote state bucket** and **DynamoDB lock table**.
- `envs/prod/`: Production stack that provisions networking, ECR, RDS, ALB/ACM/DNS and ECS.
- `modules/`: Reusable Terraform modules (network, ecr, rds, secrets, alb, ecs, github-actions-oidc).

### Running (single command)

From repo root:

```bash
cp infra/terraform/envs/prod/terraform.tfvars.example infra/terraform/envs/prod/terraform.tfvars
pnpm prod:up
```

Notes:

- ECR repositories use **immutable tags**. `pnpm prod:up` generates a fresh per-run image tag by default. Override with `PROD_IMAGE_TAG=... pnpm prod:up`.
- Images are built and pushed as **multi-arch** (`linux/amd64,linux/arm64`) via Docker buildx. Override with `DOCKER_PLATFORMS=...` if needed.
- GitHub Actions CI/CD uses AWS OIDC. After applying `envs/prod`, configure GitHub secret `AWS_ROLE_ARN` using Terraform output `github_actions_deploy_role_arn`.

### Formatting / validation / linting

```bash
pnpm infra:fmt
pnpm infra:validate
pnpm infra:tflint
```

