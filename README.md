# Badgers Investments

A single-user investment monitoring and recommendation web app. Track holdings from a transaction ledger, view performance (TWR), and get explicit **buy/sell/hold** recommendations powered by deterministic rules and AI.

**MVP scope:** Stocks and ETFs only. Other asset classes (cash, bonds, crypto, real estate, etc.) are planned for post-MVP.

---

## What it does

- **Ledger-first:** Positions are derived from transactions; you never edit position totals directly.
- **Wealth view:** Dashboard with total value, allocation, P/L, and charts (allocation, portfolio value over time).
- **Performance:** Time-weighted return (TWR, daily method) with selectable ranges.
- **Recommendations:** Manual run produces BUY/SELL/HOLD (and optional WATCH) with rationale; rules + OpenAI, with deterministic fallback if AI fails.
- **Auth:** Passwordless email OTP (AWS SES) and Postgres-backed sessions.

---

## Tech stack

- **Frontend:** Svelte SPA
- **Backend:** Fastify (Node.js/TypeScript) REST API
- **Database:** PostgreSQL (Prisma ORM, migrations)
- **Auth:** Email OTP via AWS SES; Postgres-backed cookie sessions
- **Recommendations:** OpenAI (direct integration); rules engine + deduplication
- **Deployment:** Local dev; production on AWS (ECS Fargate, RDS Postgres, SES, EventBridge, Secrets Manager, CloudWatch)

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
- **Docker** (for local PostgreSQL)
- **AWS account** (for production; SES for OTP, optional for local dev with mock or mailhog)

---

## Getting started

### 1. Clone and install

```bash
git clone <repo-url>
cd badgers-investments
pnpm install
```

### 2. Environment

Copy the example env and set required variables (database URL, SES config for OTP, OpenAI API key for recommendations):

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Database

Start Postgres (e.g. via Docker) and run migrations:

```bash
# Example: start Postgres
docker run -d --name badgers-db -e POSTGRES_USER=badgers -e POSTGRES_PASSWORD=local -e POSTGRES_DB=badgers -p 5432:5432 postgres:16

# Run migrations (when backend exists)
pnpm --filter api db:migrate
```

### 4. Run locally

From the repo root:

```bash
# Backend API (when implemented)
pnpm --filter api dev

# Frontend (when implemented)
pnpm --filter web dev
```

Then open the frontend URL (e.g. `http://localhost:5173`). Log in with email OTP once the backend and SES (or mock) are configured.

*Until the app is implemented, see **Prototype** below for a UI reference you can run.*

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

Production is designed to run on **AWS**:

- **ECS Fargate** for frontend, backend API, and worker tasks
- **RDS PostgreSQL** for the database
- **SES** for email OTP
- **Secrets Manager + KMS** for secrets
- **EventBridge** for scheduled jobs (e.g. snapshot rebuilds)
- **CloudWatch Logs** for application logs

Deploy steps and infra definitions will live under `infra/` (e.g. Terraform or CDK) and CI under `.github/` when added.

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
