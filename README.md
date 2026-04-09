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
- **Deployment:** Local dev against cloud DynamoDB; production on AWS (ECS Fargate, Secrets Manager, CloudWatch; EventBridge for workers where used)

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

Default dev table name is **`badgers-investments-dev-ddb`** (composite keys **`PK` / `SK`**, GSI **`GSI1`** on **`GSI1PK` / `GSI1SK`**, on-demand billing), matching prod and provisioned with Terraform under `infra/terraform/envs/dev`.

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

Outputs include `app_dynamodb_table_name` / `app_dynamodb_table_arn`. Set `API_DYNAMODB_TABLE_NAME=badgers-investments-dev-ddb` in `.env` (already the default in `.env.example`).

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

Production is designed to run on **AWS**:

- **ECS Fargate** for frontend, backend API, and worker tasks
- **Amazon DynamoDB** for application data (table supplied via Terraform variable `dynamodb_table_name`)
- **Secrets Manager + KMS** for secrets (e.g. cookie signing)
- **EventBridge** for scheduled jobs (e.g. snapshot rebuilds), where enabled
- **CloudWatch Logs** for application logs

Infrastructure-as-code lives under `infra/terraform/` (Terraform).

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

### One-command production bring-up

1) Create your production variables file:

```bash
cp infra/terraform/envs/prod/terraform.tfvars.example infra/terraform/envs/prod/terraform.tfvars
```

2) Fill in at least `aws_region`, `dynamodb_table_name` (existing table), and (if using Route53-managed DNS) `route53_zone_id`, then run:

```bash
pnpm prod:up
```

`pnpm prod:up` performs:

- Bootstrap Terraform remote state (S3 + DynamoDB lock)
- `terraform apply` for shared infra
- Build + push Docker images to ECR (multi-arch; uses an immutable per-run image tag by default)
- `terraform apply` again to enable ECS services with the new image tags
- Smoke tests:
  - `https://api.investments.badgers.nl/health`
  - `https://api.investments.badgers.nl/ready`
  - `https://investments.badgers.nl/`

Notes:

- ECR repositories are configured with **immutable tags**, so rerunning `pnpm prod:up` will generate a **new** image tag per run.
- Override the tag if needed: `PROD_IMAGE_TAG=... pnpm prod:up`
- Override build platforms if needed: `DOCKER_PLATFORMS=linux/amd64,linux/arm64 pnpm deploy:prod <tag>`

### Manual production commands (optional)

```bash
# Build + push images (expects an image tag argument, typically git SHA)
pnpm deploy:prod

# Smoke test production domains
pnpm smoke:prod
```

### CI/CD (GitHub Actions)

This repo uses **GitHub Actions** for CI/CD:

- **Pull requests** run: `pnpm lint`, `pnpm test`, `pnpm build`
- **Push to `main`** runs a production deploy (build + push images, ECS rolling deploy, smoke tests)

#### Required GitHub configuration

**Secrets** (GitHub repo settings):

- `AWS_ROLE_ARN` — IAM role to assume via OIDC (see Terraform output `github_actions_deploy_role_arn`).

**Variables** (GitHub repo settings):

- `AWS_REGION` — AWS region (e.g. `us-east-1`)
- `ECR_REPO_PREFIX` — ECR repo prefix (defaults to `badgers-investments-prod` in Terraform naming)
- `ECS_CLUSTER_NAME` — ECS cluster name (Terraform output `ecs_cluster_name`)
- `ECS_API_SERVICE_NAME` — API ECS service name (Terraform output `ecs_api_service_name`)
- `ECS_WEB_SERVICE_NAME` — Web ECS service name (Terraform output `ecs_web_service_name`)
- `API_DOMAIN` — API domain (e.g. `api.investments.badgers.nl`)
- `WEB_DOMAIN` — Web domain (e.g. `investments.badgers.nl`)
- `DOCKER_PLATFORMS` — Optional override (default: `linux/amd64,linux/arm64`)

#### Rollback

Use the **“Deploy production (AWS ECS)”** workflow (`workflow_dispatch`) and pass a previous `image_tag` (for example an older git SHA) to redeploy that version.

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
