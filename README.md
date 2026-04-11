# Badgers Investments

A single-user investment monitoring and recommendation web app. Track holdings from a transaction ledger, view performance (TWR), and get explicit **buy/sell/hold** recommendations powered by deterministic rules and AI.

**MVP scope:** Stocks and ETFs only. Other asset classes (cash, bonds, crypto, real estate, etc.) are planned for post-MVP.

---

## What it does

- **Ledger-first:** Positions are derived from transactions; you never edit position totals directly.
- **Wealth view:** Dashboard with total value, allocation, P/L, and charts (allocation, portfolio value over time).
- **Performance:** Time-weighted return (TWR, daily method) with selectable ranges.
- **Recommendations:** Manual run produces BUY/SELL/HOLD (and optional WATCH) with rationale; rules + OpenAI, with deterministic fallback if AI fails.
- **Auth:** Username + password (stored hashed) and DynamoDB-backed sessions.

---

## Tech stack

- **Frontend:** Svelte SPA
- **Backend:** Fastify (Node.js/TypeScript) REST API
- **Database:** Amazon DynamoDB (AWS SDK v3)
- **Auth:** Username + password (hashed); DynamoDB-backed cookie sessions
- **Recommendations:** OpenAI (direct integration); rules engine + deduplication
- **Deployment:** Local dev against cloud DynamoDB; production on AWS (S3 + CloudFront for static web, API Gateway HTTP API + Lambda for API, scheduled Lambda worker, DynamoDB, Secrets Manager, CloudWatch)

---

## Repository structure

The repo is organised as a monorepo (Turborepo + pnpm):

- **`apps/`** — User-facing apps (e.g. `web` for the Svelte app)
- **`services/`** — Backend API and other deployable services
- **`workers/`** — Batch/scheduled jobs (e.g. snapshot rebuilds)
- **`shared/`** — Shared code by language (e.g. `shared/typescript/*`)
- **`docs/`** — Product, architecture, requirements, ADRs, prototype
- **`tools/`** — Scripts, codegen, release
- **`infra/`** — IaC / Docker / deploy (optional)

*Application code will live under `apps/`, `services/`, and `workers/` once implementation starts.*

---

## Prerequisites

- **Node.js** (LTS) and **pnpm**
- **AWS account** and credentials (local API and production use DynamoDB in AWS)
- **Docker** (optional — for running Terraform format/validate via pinned images)

---

## Getting started

### 1. Clone and install

```bash
git clone <repo-url>
cd badgers-investments
pnpm install
```

### 2. Environment

Copy the root env template and set **DynamoDB** table name, region, API port, and (when needed) `OPENAI_KEY`.

All env variables live at the repo root (no per-service `.env` files).

```bash
cp .env.example .env
# Edit .env with your values
```

Required for the API:

- `API_DYNAMODB_TABLE_NAME` — use a **dev** table in your account (never point local dev at prod if you care about data).
- `API_DYNAMODB_REGION` and/or `AWS_REGION` / `AWS_DEFAULT_REGION`.

Optional:

- `API_DYNAMODB_ENDPOINT` — custom endpoint only (e.g. LocalStack). Omit for real DynamoDB.
- `OPENAI_KEY` — when the recommendations module is enabled.

### 3. DynamoDB (dev table)

Default dev table name is **`badgers-investments-dev`** (same `-dev` / `-prod` pattern as production; composite keys **`PK` / `SK`**, GSI **`GSI1`** on **`GSI1PK` / `GSI1SK`**, on-demand billing), provisioned with Terraform under `infra/terraform/envs/dev`.

1. **Credentials:** e.g. `aws sso login` or `export AWS_PROFILE=...`.
2. **Bootstrap** (once per account): if you have not already, run `pnpm infra:bootstrap` and note the S3 state bucket name.
3. **Create dev table state + apply:**

```bash
cp infra/terraform/envs/dev/terraform.tfvars.example infra/terraform/envs/dev/terraform.tfvars
cp infra/terraform/envs/dev/backend.hcl.example infra/terraform/envs/dev/backend.hcl
# Edit backend.hcl: set bucket (from bootstrap output), region, and keep key = "badgers-investments/dev/terraform.tfstate"

pnpm infra:dev:init
pnpm infra:dev:apply
```

Outputs include `app_dynamodb_table_name` / `app_dynamodb_table_arn`. Set `API_DYNAMODB_TABLE_NAME=badgers-investments-dev` in `.env` (already the default in `.env.example`).

4. **Readiness:** `GET /ready` calls `DescribeTable` on `API_DYNAMODB_TABLE_NAME`.

5. **Verify read/write:**

```bash
pnpm dynamodb:smoke-write
```

**IAM:** Scope your user/role to the dev table ARN (and index ARNs when you add GSIs).

**Alternative:** create the same key schema manually with `aws dynamodb create-table` if you prefer not to use the `envs/dev` stack.

### 4. Run locally

From the repo root:

```bash
pnpm dev
```

Then open the frontend URL (default `http://localhost:5173`). The API listens on `http://localhost:3000` by default.

Ensure AWS credentials allow `dynamodb:DescribeTable` (and other actions your routes need) before expecting `GET /ready` to succeed.

---

## Testing

- **Unit tests:** Financial logic (FIFO, TWR, rules, scoring) and domain services.
- **Integration tests:** API paths, auth flow (mocked SES), recommendation run (mocked OpenAI), where implemented.

From the repo root:

```bash
pnpm test
```

*(Add per-package test scripts as the codebase grows.)*

---

## Deployment

Production runs on **AWS** (serverless-oriented):

- **S3 + CloudFront** for the static SPA (`adapter-static`)
- **API Gateway (HTTP API) + AWS Lambda (Node.js 20)** for the Fastify API (`@fastify/aws-lambda`)
- **EventBridge + Lambda** for scheduled worker jobs
- **Amazon DynamoDB** for application data (`dynamodb_table_name` in Terraform; table must already exist)
- **Secrets Manager** for app secrets (e.g. cookie signing); **CloudWatch Logs** for Lambdas

Infrastructure-as-code: `infra/terraform/`.

### Prerequisites (production)

- Docker (to run Terraform/tflint via containers)
- AWS CLI configured for the target account
- Terraform optional (scripts can run via Docker)

### Terraform quality checks (before applying)

From the repo root:

```bash
# Format Terraform code
pnpm infra:fmt

# Initializes providers (backend disabled) and validates config.
# Also generates/updates: infra/terraform/envs/prod/.terraform.lock.hcl
pnpm infra:validate

# Runs tflint (auto-initializes plugins, cached under ./.tflint.d)
pnpm infra:tflint
```

### One-command production Terraform apply

1) Create your production variables file:

```bash
cp infra/terraform/envs/prod/terraform.tfvars.example infra/terraform/envs/prod/terraform.tfvars
```

2) Fill in at least `aws_region`, `dynamodb_table_name`, `web_domain`, `api_domain`, and **`dns_zone_name`** (default `badgers.nl`), plus create `infra/terraform/envs/prod/backend.hcl` for remote state.

3) Run:

```bash
pnpm prod:up
```

This runs **`terraform apply`** for the serverless prod stack: **Route53 hosted zone** for `dns_zone_name`, ACM validation + **A/AAAA alias records** for `web_domain` and `api_domain`, static site, API Lambda + HTTP API + custom domain, worker Lambda + schedule, Secrets Manager, GitHub OIDC deploy role. It does **not** deploy application code; use GitHub Actions or `tools/prod/deploy-prod.sh` after Terraform outputs exist.

4) **DNS delegation:** after the first successful apply, run `terraform output route53_name_servers` (from `infra/terraform/envs/prod`) and set those **NS records** at your domain registrar for the apex (`dns_zone_name`). Until delegation matches Route53, public DNS for `web_domain` / `api_domain` may not resolve.

### Manual application deploy (optional)

After Terraform has run at least once:

```bash
export AWS_REGION=...   # same region as prod stack
export PUBLIC_API_BASE_URL=https://<api-domain>
pnpm deploy:prod
```

`pnpm deploy:prod` builds the static web app and Lambda bundles, uploads to S3 and Lambda, and invalidates CloudFront.

```bash
# Smoke test (reads domains from prod terraform.tfvars)
pnpm smoke:prod
```

### CI/CD (GitHub Actions)

- **Pull requests:** **CI** only — `pnpm lint`, `pnpm test`, `pnpm build` (`ci-reusable.yml`).
- **Push to `main`:** **Deploy production (serverless)** — CI must pass.
  - **`infra/**` changed:** run **Terraform validate** + **`terraform apply`** (needs `PROD_*` secrets), then **app deploy** (infra changes are included in the path gate that triggers deploy, so Lambdas and static assets refresh after infra updates).
  - **App-only change:** skip Terraform; run app deploy only.
- **Workflow dispatch:** Toggle **terraform apply** and/or **deploy application** (e.g. redeploy app without `apply`).

#### GitHub configuration

**Secrets**

- `AWS_ROLE_ARN` — assume via OIDC (Terraform output `github_actions_deploy_role_arn`).
- `PROD_TF_BACKEND_HCL` — paste full contents of `infra/terraform/envs/prod/backend.hcl` (same fields as `infra/terraform/envs/prod/backend.hcl.example`).
- `PROD_TFVARS` — paste full contents of `infra/terraform/envs/prod/terraform.tfvars` (include `github_actions_grant_terraform_apply = true` once you want CI to apply; see below).

**Terraform in CI (one-time bootstrap)**

1. Run **`pnpm prod:up`** locally (or otherwise apply) so the OIDC role and state exist.
2. In `terraform.tfvars`, set **`github_actions_grant_terraform_apply = true`**, then apply again (locally or manually). This attaches **AdministratorAccess** to the GitHub Actions deploy role so CI can manage the full stack and state. *Use a dedicated AWS account if possible; replace with a narrower custom policy if you outgrow this.*
3. Copy **`backend.hcl`** and **`terraform.tfvars`** into secrets **`PROD_TF_BACKEND_HCL`** and **`PROD_TFVARS`**. Keep them in sync when you change backend or variables.

**Variables** (copy from `terraform output` after apply)

- `AWS_REGION`
- `API_DOMAIN` — hostname only (e.g. `api.investments.badgers.nl`)
- `WEB_DOMAIN` — hostname only (e.g. `investments.badgers.nl`)
- `S3_WEB_BUCKET` — output `web_s3_bucket_id`
- `CLOUDFRONT_DISTRIBUTION_ID` — output `cloudfront_distribution_id`
- `LAMBDA_API_FUNCTION_NAME` — output `lambda_api_function_name`
- `LAMBDA_WORKER_FUNCTION_NAME` — output `lambda_worker_function_name`

#### Rollback

Re-run **Deploy production (serverless)** on a previous commit (or upload an older Lambda zip / S3 snapshot manually).

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/product.md](docs/product.md) | Product strategy and vision |
| [docs/product-requirements-mvp.md](docs/product-requirements-mvp.md) | MVP PRD (scope: stocks only) |
| [docs/functional-requirements-mvp.md](docs/functional-requirements-mvp.md) | Functional requirements |
| [docs/architecture.md](docs/architecture.md) | System architecture (SAD) |
| [docs/architecture-decision-records.md](docs/architecture-decision-records.md) | ADRs (auth, deployment, snapshots, TWR, recommendations, etc.) |
| [docs/recommendation-spec-v1.md](docs/recommendation-spec-v1.md) | Recommendation engine spec (rules, AI, output schema) |

---

## Prototype

A Figma-derived UI prototype (React + Vite) is in **`docs/prototype/`**. It illustrates Dashboard, Assets, Ledger, Performance, and Recommendations; the **Explore** page is out of MVP scope.

- **Figma:** [Badgers Finance Prototype](https://www.figma.com/design/lts47RenSB6zV99RbIrJOy/Badgers-Finance-Prototype)
- **Run the prototype:** See [docs/prototype/README.md](docs/prototype/README.md) for how it maps to the MVP and how to run it (`npm i` and `npm run dev` in that folder).

---

## License

Proprietary. All rights reserved.
