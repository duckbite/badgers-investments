# Terraform — Badgers Investments

Infrastructure-as-code for **bootstrap** (remote state), **dev** (optional DynamoDB application table for local development), and **prod** (**serverless**: S3 + CloudFront, API Gateway + Lambda, scheduled worker Lambda, Secrets Manager, Route53 where configured).

## Layout

- **`bootstrap/`** — S3 remote state bucket and DynamoDB state lock table.
- **`envs/dev/`** — Application DynamoDB table for developers (`app-dynamodb-table`).
- **`envs/prod/`** — Production serverless stack: static site, HTTP API + Lambda, worker Lambda + EventBridge rule, GitHub Actions OIDC deploy role. Expects an **existing** application DynamoDB table name in `terraform.tfvars` (`dynamodb_table_name`); Terraform does not create that table in prod.
- **`modules/`** — `app-dynamodb-table`, `api_lambda`, `github-actions-oidc`, `secrets`, `static_site`, `worker_lambda`.

## Conventions

- **Region:** set `aws_region` in each env’s `terraform.tfvars`.
- **Secrets:** prod Lambda reads `COOKIE_SECRET` from Secrets Manager; Terraform injects it into the API Lambda environment from the `secrets` module JSON.

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
