## Terraform (AWS)

This folder contains infrastructure-as-code for Badgers Investments: **bootstrap** (remote state), **dev** (application DynamoDB for local development), and **prod** (ECS Fargate + ALB + ACM + Secrets Manager + CloudWatch Logs).

### Layout

- `bootstrap/`: **S3** remote state bucket and **DynamoDB** state lock table.
- `envs/dev/`: **Application DynamoDB** table for development (default name `badgers-investments-dev-ddb`).
- `envs/prod/`: Production networking, ECR, ALB/ACM/DNS, ECS; references an application DynamoDB table by name (`dynamodb_table_name` in `terraform.tfvars`).
- `modules/`: Shared modules (`app-dynamodb-table`, network, ecr, secrets, alb, ecs, github-actions-oidc).

### Dev application table (DynamoDB)

From repo root (after bootstrap and editing `infra/terraform/envs/dev/backend.hcl`):

```bash
cp infra/terraform/envs/dev/terraform.tfvars.example infra/terraform/envs/dev/terraform.tfvars
pnpm infra:dev:init
pnpm infra:dev:apply
```

Use `terraform output` in `envs/dev` for table name and ARN. Point local `.env` at `API_DYNAMODB_TABLE_NAME=badgers-investments-dev-ddb` (default in `.env.example`).

### Production (single command)

```bash
cp infra/terraform/envs/prod/terraform.tfvars.example infra/terraform/envs/prod/terraform.tfvars
pnpm prod:up
```

Set `dynamodb_table_name` in prod `terraform.tfvars` to your **production** application table (create via Terraform, console, or reuse a module like `modules/app-dynamodb-table` in a separate state if you prefer).

### Formatting / validation / linting

```bash
pnpm infra:fmt
pnpm infra:validate      # prod env (Dockerized in package.json)
pnpm infra:dev:validate   # dev env (local Terraform when installed)
pnpm infra:tflint
```
