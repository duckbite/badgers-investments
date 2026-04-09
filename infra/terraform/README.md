## Terraform (AWS production)

This folder contains Terraform infrastructure-as-code for deploying Badgers Investments to AWS using a **serverless** production architecture:
- **Web**: S3 (private) + CloudFront (OAC) + ACM
- **API**: API Gateway (HTTP API) → Lambda
- **Data**: DynamoDB (single-table)
- **CI/CD auth**: GitHub Actions OIDC (no long-lived AWS keys)

### Layout

- `bootstrap/`: Creates the **S3 remote state bucket** and **DynamoDB lock table**.
- `envs/prod/`: **Current** production stack (serverless).
- `envs/prod-legacy/`: Legacy ECS/RDS stack preserved only to support teardown of existing resources.
- `modules/`: Reusable Terraform modules.

### Running (single command)

From repo root:

```bash
cp infra/terraform/envs/prod/terraform.tfvars.example infra/terraform/envs/prod/terraform.tfvars
pnpm prod:up
```

Notes:

- GitHub Actions CI/CD uses AWS OIDC. After applying `envs/prod`, configure GitHub secret `AWS_ROLE_ARN` using Terraform output `github_actions_deploy_role_arn`.
- To tear down the **legacy** ECS/RDS stack, remote state must live at **`{project}/prod-legacy/terraform.tfstate`** (same bucket as bootstrap; never the same key as `envs/prod`). **Before** you first apply serverless `envs/prod`, copy the old `prod` state object to the `prod-legacy` key (or restore a backup there). Otherwise `prod:legacy:down` will refuse (empty state) or cannot track real ECS/RDS resources.
- Then run:

```bash
CONFIRM_PROD_LEGACY_DESTROY=1 pnpm prod:legacy:down
```

### Formatting / validation / linting

```bash
pnpm infra:fmt
pnpm infra:validate
pnpm infra:tflint
```

