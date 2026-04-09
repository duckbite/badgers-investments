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
- **Database:** DynamoDB (single-table) in production
- **Legacy (in repo today):** PostgreSQL + Prisma artifacts are still present while the persistence layer is migrated
- **Auth:** Username + password (hashed); DynamoDB-backed cookie sessions
- **Recommendations:** OpenAI (direct integration); rules engine + deduplication
- **Deployment:** Local dev; production on AWS (S3 + CloudFront + API Gateway + Lambda + DynamoDB)

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
- **Docker** (optional; used by legacy local PostgreSQL setup)
- **AWS account** (for production, if deploying to AWS)

---

## Getting started

### 1. Clone and install

```bash
git clone <repo-url>
cd badgers-investments
pnpm install
```

### 2. Environment

Copy the root env template and set required variables (OpenAI API key for recommendations once enabled; any API ports/config used during local dev).

All env variables live at the repo root (no per-service `.env` files).

```bash
cp .env.example .env
# Edit .env with your values
```

Notes:

- The API reads `API_DATABASE_URL` and also accepts `DATABASE_URL` as a fallback.
- `OPENAI_KEY` is only required once the recommendations module is enabled.

### 3. Database

Legacy local database (Postgres + Prisma) while the app is being migrated to DynamoDB:

```bash
# Start Postgres
pnpm db:up

# Generate Prisma client and apply migrations
pnpm db:generate
pnpm db:deploy
```

To stop the local database:

```bash
pnpm db:down
```

To reset it (drops the volume):

```bash
pnpm db:reset
```

### 4. Run locally

From the repo root:

```bash
# One command (DB + migrations + API + web)
pnpm dev:up
```

Or, if your database is already running:

```bash
pnpm dev
```

Then open the frontend URL (default `http://localhost:5173`). The API listens on `http://localhost:3000` by default.

---

## Testing

- **Unit tests:** Financial logic (FIFO, TWR, rules, scoring) and domain services.
- **Integration tests:** API + DB, auth flow (mocked SES), recommendation run (mocked OpenAI).

From the repo root:

```bash
pnpm test
```

*(Add per-package test scripts as the codebase grows.)*

---

## Deployment

Production is designed to run on **AWS** with an ultra-low-cost **serverless** topology:

- **S3 + CloudFront** for the static web frontend (OAC)
- **API Gateway (HTTP API) + Lambda** for the backend API
- **DynamoDB** for the application datastore
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

2) Fill in at least `aws_region` and (if using Route53-managed DNS) `route53_zone_id`, then run:

```bash
pnpm prod:up
```

`pnpm prod:up` performs:

- Bootstrap Terraform remote state (S3 + DynamoDB lock)
- `terraform apply` for production infrastructure (serverless)
- (Optional) deploy static web build to S3 and invalidate CloudFront: `pnpm deploy:prod`
- Smoke tests:
  - `https://api.investments.badgers.nl/`
  - `https://investments.badgers.nl/`
  - `https://api.investments.badgers.nl/ready`
  - `https://investments.badgers.nl/`

Notes:

- The legacy ECS/RDS production stack is preserved under `infra/terraform/envs/prod-legacy` only to support teardown of existing resources.
- To destroy the legacy stack, run: `CONFIRM_PROD_LEGACY_DESTROY=1 pnpm prod:legacy:down`

### Manual production commands (optional)

```bash
pnpm deploy:prod

# Smoke test production domains
pnpm smoke:prod
```

### CI/CD (GitHub Actions)

This repo uses **GitHub Actions** for CI/CD:

- **Pull requests** run: `pnpm lint`, `pnpm test`, `pnpm build`
- **Push to `main`** runs a production deploy (build web, upload to S3, invalidate CloudFront)

#### Required GitHub configuration

**Secrets** (GitHub repo settings):

- `AWS_ROLE_ARN` — IAM role to assume via OIDC (see Terraform output `github_actions_deploy_role_arn`).

**Variables** (GitHub repo settings):

- `AWS_REGION` — AWS region (e.g. `us-east-1`)
- `WEB_S3_BUCKET` — Web bucket name (Terraform output `web_bucket_name`)
- `CLOUDFRONT_DISTRIBUTION_ID` — CloudFront distribution ID (Terraform output `cloudfront_distribution_id`)
- `DOCKER_PLATFORMS` — Optional override (default: `linux/amd64,linux/arm64`)

#### Rollback

Rollback for the static web is “last upload wins”; redeploy a previous build by re-running the workflow from an older commit (or re-uploading a prior artifact) and invalidating CloudFront.

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
