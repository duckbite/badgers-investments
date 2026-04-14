# Terraform — Badgers Investments

Infrastructure-as-code for **bootstrap** (remote state), **dev** (optional DynamoDB application table for local development), and **prod** (**serverless**: public Route53 zone + records, S3 + CloudFront, API Gateway + Lambda, worker Lambda, application DynamoDB with deletion protection, Secrets Manager, GitHub OIDC).

## Layout

- **`bootstrap/`** — S3 remote state bucket and DynamoDB state lock table.
- **`envs/dev/`** — Application DynamoDB table for developers (`app-dynamodb-table`).
- **`envs/prod/`** — Production serverless stack: **creates `dns_zone_name` hosted zone** (default `badgers.nl`) and manages ACM + aliases for `web_domain` / `api_domain`, static site, HTTP API + Lambda, worker + EventBridge, **application DynamoDB** (`dynamodb_table_name`, **deletion protection** + PITR), OIDC deploy role.
- **`modules/`** — `app-dynamodb-table`, `api_lambda`, `github-actions-oidc`, `public_dns_zone`, `secrets`, `static_site`, `worker_lambda`.

## Conventions

- **Region:** set `aws_region` in each env’s `terraform.tfvars`.
- **Secrets:** prod API Lambda reads app JSON from Secrets Manager (`secrets` module): `COOKIE_SECRET`, `API_AI_SETTINGS_SECRET`, and `API_PRIVACY_SECRET` (Terraform-generated `random_password` values so `apply` does not wipe manually added keys). Terraform injects those into the Lambda environment. Non-secret defaults such as `API_AI_MODEL_*` are set via prod `terraform.tfvars` / variables (defaults match `.env.example`).

## Useful commands (repo root)

```bash
pnpm infra:fmt
pnpm infra:validate   # prod env, backend disabled in container/local
pnpm infra:tflint
```

Apply prod (after `backend.hcl` + `terraform.tfvars`):

```bash
pnpm prod:up
```

See **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** for common apply errors (non-empty S3 bucket, duplicate IAM/OAC, ACM validation).

To let **GitHub Actions** run `terraform apply` on `infra/**` changes: set `github_actions_grant_terraform_apply = true` in `terraform.tfvars`, apply once (locally or CI), add GitHub secrets **`PROD_TF_BACKEND_HCL`** and **`PROD_TFVARS`** (full contents of `backend.hcl` and `terraform.tfvars`), and see root **README** CI/CD section. The OIDC role gains **AdministratorAccess** when this flag is true (acceptable for small accounts; narrow policies are possible but tedious).

## Production bootstrap — from GitHub / backend secrets onward (steps 6+)

Assume **steps 1–5** are done: repo **Actions variables** / secrets for AWS role and Terraform (`PROD_TF_BACKEND_HCL`, `PROD_TFVARS`, `AWS_ROLE_ARN`, etc.) match your account.

1. **Set `dynamodb_table_name`** in `terraform.tfvars` / **`PROD_TFVARS`**; prod Terraform **creates** the table (or `terraform import module.app_dynamodb.aws_dynamodb_table.app <name>` if it already exists). To allow deletion, set **`app_dynamodb_deletion_protection = false`**, apply, then destroy or remove the module.
2. **Apply prod** from `infra/terraform/envs/prod` (or root `pnpm prod:up` if that wraps apply): `terraform init -backend-config=backend.hcl` then `terraform apply`. A plan that **removes** an old `random_id.bucket_suffix` (or similar) usually means state moved to the new module layout—review the plan before approving.
3. **Delegate DNS**: at the registrar for the **apex** domain (`dns_zone_name`), replace nameservers with **`terraform output -raw route53_name_servers`** (or the console hosted zone NS set). Wait for propagation before expecting HTTPS on `web_domain` / `api_domain`.
4. **Refresh `PROD_TFVARS`** in GitHub whenever local `terraform.tfvars` changes so CI uses the same inputs.
5. **CI Terraform apply**: when you want the workflow to run **`terraform apply`**, set `github_actions_grant_terraform_apply = true`, **apply once** so the OIDC role policy updates, then merge infra changes as usual.
6. **App deploy**: trigger **Deploy production** (push to `main` on relevant paths, or `workflow_dispatch`) after DNS and apply succeed.
