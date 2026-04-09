# Project structure

Human- and machine-readable folder layout for Badgers Investments monorepo.

## Root

| Path | Description |
|------|-------------|
| `package.json` | Root package: pnpm workspace scripts (`build`, `dev`, `lint`, `test`), Turborepo and TypeScript as devDependencies. Private; not published. |
| `pnpm-workspace.yaml` | pnpm workspace definition: `apps/*`, `services/*`, `workers/*`, `shared/*/*`, `tools/*`. |
| `turbo.json` | Turborepo pipeline: `build` (with ^build), `dev` (persistent), `lint`, `test`, `clean`. |
| `.env.example` | Root environment template (copy to `.env`). DynamoDB and API settings; all env variables live at repo root. |
| `README.md` | How to run, test, and deploy the application. |
| `.gitignore` | Ignored paths (node_modules, build outputs, env files, etc.). |
| `.github/` | GitHub Actions workflows (CI/CD). |

## Apps

| Path | Description |
|------|-------------|
| `apps/web/` | SvelteKit (Svelte 5) frontend. Entry: `src/routes/+page.svelte`. Scripts: `dev`, `build`, `preview`, `check`, `lint`. Build output: `.svelte-kit/` and Vite build artifacts. |

## Services

| Path | Description |
|------|-------------|
| `services/api/` | Fastify backend REST API (Node.js/TypeScript). Entry: `src/index.ts`. Scripts: `dev` (tsx watch), `build` (tsc), `start`, `lint`, `clean`. Build output: `dist/`. Modules live under `src/modules/` (health + domain modules per `docs/architecture.md`). |
| `services/api/src/config/get-dynamo-db-config.ts` | DynamoDB settings from env (`API_DYNAMODB_*`, region fallbacks); required for the API. |
| `services/api/src/db/create-dynamo-db-client.ts` | Factory for `DynamoDBClient` (optional custom endpoint for tools like LocalStack). |
| `services/api/src/modules/health/dynamo-db-health-service.ts` | Readiness: `DescribeTable` on the configured table. |
| `services/api/src/scripts/dynamodb-smoke-write.ts` | Dev CLI: put+delete smoke item; run via `pnpm dynamodb:smoke-write` from repo root. |

## Workers

| Path | Description |
|------|-------------|
| `workers/worker/` | Worker runtime for scheduled/heavy jobs (e.g. snapshot rebuilds). Entry: `src/index.ts`. Scripts: `dev`, `build`, `start`, `lint`, `clean`. Build output: `dist/`. |

## Shared

| Path | Description |
|------|-------------|
| `shared/typescript/base/` | Shared TypeScript configs: `base.json` (strict, ESNext), `node.json` (Node/backend), `svelte.json` (Svelte/ browser). Consumed by apps, services, and workers via `extends`. Package: `@badgers-investments/tsconfig-base`. |

## Infrastructure

| Path | Description |
|------|-------------|
| `infra/terraform/bootstrap/` | Remote state bucket + state-lock DynamoDB table. |
| `infra/terraform/envs/dev/` | Terraform workspace for **dev** application DynamoDB (`badgers-investments-dev-ddb` by default). |
| `infra/terraform/envs/prod/` | Production stack (VPC, ECS, ALB, etc.). |
| `infra/terraform/modules/app-dynamodb-table/` | Reusable on-demand DynamoDB table (`PK` / `SK`, optional **`GSI1`** mirroring prod). |

## Docs and tooling

| Path | Description |
|------|-------------|
| `docs/` | Product, architecture, requirements, ADRs, domain model, recommendation spec, prototype. |
| `docs/prototype/` | Figma-derived UI prototype (React + Vite); reference only, not part of workspace. |
| `tools/` | Scripts, codegen, release tooling. |
| `.cursor/` | Cursor rules and project config. |
| `logs/` | Conversation and decision logs (see .cursor rules). |

## Out of workspace

- `docs/prototype/` has its own `package.json` and is run with `npm`/`pnpm` from that directory; it is not listed in `pnpm-workspace.yaml`.

## Commands (from repo root)

- `pnpm install` — Install all workspace dependencies.
- `pnpm build` — Build all packages (Turborepo).
- `pnpm dev` — Run `dev` in all packages that define it (Turborepo).
- `pnpm --filter web dev` — Run frontend dev server only.
- `pnpm --filter api dev` — Run API dev server only.
- `pnpm --filter worker dev` — Run worker in watch mode only.
- `pnpm dynamodb:smoke-write` — Verify DynamoDB put/delete using root `.env` (requires `API_DYNAMODB_TABLE_NAME` and region env).
- `pnpm infra:dev:init` / `pnpm infra:dev:apply` — Create **dev** app DynamoDB table via Terraform (requires `infra/terraform/envs/dev/backend.hcl`; see `backend.hcl.example`).
