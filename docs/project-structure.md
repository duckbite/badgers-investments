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
| `logs/` | Agent conversation logs (`chat-YYYY-MM-DD.md`) and `decision-log.md` (project decisions). |
| `insomnia/` | Insomnia REST client assets (v5.1 YAML): `collections/badgers-api.yaml`, `environments/local-dev.yaml`, `README.md` — manual API testing; not part of the pnpm workspace. |
| `.gitignore` | Ignored paths (node_modules, build outputs, env files, etc.). |
| `.github/` | GitHub Actions workflows (CI/CD). |
| `.github/workflows/ci-reusable.yml` | Reusable workflow: `pnpm lint`, `test`, `build` (Turbo). Called from PR **CI** and from **main** deploy workflow. |
| `.github/workflows/ci.yml` | Pull-request **CI** only (calls `ci-reusable.yml`). |
| `.github/workflows/deploy-prod.yml` | **Main** branch CD: CI → path-gated **Terraform validate + apply** when `infra/**` changes (plus optional manual toggles) → Lambda bundles + static web → S3/CloudFront + smoke. |

## Apps

| Path | Description |
|------|-------------|
| `apps/web/` | SvelteKit (Svelte 5) frontend. Entry: `src/routes/+page.svelte`. Scripts: `dev`, `build`, `preview`, `check`, `lint`. Build output: `.svelte-kit/` and Vite build artifacts. |
| `apps/web/static/badgers-logo.png` | Login branding asset (same artwork as `docs/prototype` Figma export); served at `/badgers-logo.png`. |
| `apps/web/vite.config.ts` | Vite + **`@tailwindcss/vite`** (Tailwind v4, aligned with `docs/prototype`). Loads root `.env` via `envDir`; dev `server.port` from `WEB_PORT` (default `5173`); `define` sets `import.meta.env.PUBLIC_API_BASE_URL` and `import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY` (from root env; prod builds use GitHub secret `PUBLIC_GOOGLE_MAPS_API_KEY`). |
| `apps/web/src/styles/index.css` | Entry: imports Tailwind + **`theme.css`** (shadcn-style tokens copied from `docs/prototype/src/styles/theme.css`). |
| `apps/web/src/styles/tailwind.css` | `@tailwindcss` + `@source` for `**/*.{js,ts,svelte}` + `tw-animate-css`. |
| `apps/web/package.json` | **`lucide-svelte`** icons (parity with prototype `lucide-react`). |
| `apps/web/src/lib/theme/theme.ts` | Theme: `document.documentElement.classList.toggle('dark', …)` + `localStorage` `badgers-theme` (inline script in `app.html` sets initial class). |
| `apps/web/src/routes/prices/+page.svelte` | Prices hub: manual entry **only** for assets without `primaryPriceProviderKey`, latest per asset (with provider label), last Yahoo batch job status from `GET /market-prices/status`, **Run market price job** (`POST /market-prices/run`), snapshot rebuild. |
| `apps/web/src/routes/explore/+page.svelte` | Explore hub UI (DB-144): tools grid, Technical Analysis + Portfolio Builder dialogs, run submission via `/analysis/runs`, and realtime recent-run updates over WebSocket (`analysis` domain events). |
| `apps/web/src/routes/library/+page.svelte` | Library page (DB-145): search/filter + My/All tabs, report cards, report viewer modal with **sanitized markdown-to-HTML rendering** (`marked` + `DOMPurify`), **bundle asset URL rewriting** (`rewriteBundleAssetReferencesInMarkdown` + `bundleAssetUrls` from `GET /analysis/reports/:id`) so `assets/…` images load via presigned S3 URLs, markdown export via `/analysis/reports/:id/export`. |
| `apps/web/src/lib/api/analysis.ts` | Typed API client helpers for analysis runs and reports (`/analysis/runs`, `/analysis/reports`); report detail includes optional `storageBundlePrefix`, `storageManifestKey`, `bundleAssetUrls`. |
| `apps/web/src/lib/api/rewrite-bundle-asset-markdown.ts` | Rewrites markdown image/HTML `src` paths to presigned URLs for ADR-013 analysis report bundles. |
| `apps/web/src/lib/domain/analysis-tools.ts` | Shared analysis tool registry (tool IDs/titles/colors/icons) and `formatAnalysisType()`. |
| `apps/web/src/lib/realtime/analysis-runs-feed.ts` | Browser WebSocket client for `analysis` run lifecycle events with reconnect/backoff + single reconciliation callback. |
| `apps/web/src/lib/api/build-portfolio-config-put-body.ts` | Builds `PUT /portfolio/config` JSON with only API-allowed fields (no `configVersionId` / version metadata from `GET`); used by settings save and header currency sync. |
| `apps/web/src/lib/maps/load-google-maps-places.ts` | Singleton Maps JS bootstrap (`loading=async`) + `importLibrary('places')` for `PlaceAutocompleteElement` (Places API New). |
| `apps/web/src/lib/components/GooglePlacesLocationInput.svelte` | Profile location: `PlaceAutocompleteElement` + `gmp-select` when key is set; plain text fallback. |
| `apps/web/src/lib/components/WholeCurrencyAmountInput.svelte` | Whole-number amount with locale thousands grouping + ISO currency select (allowed codes). |
| `apps/web/src/lib/toast/toast.ts` | Lightweight toast queue (`toast.error` / `toast.success`) for Sonner-like UX (top-right); used on login and available app-wide. |
| `apps/web/src/lib/toast/ToastHost.svelte` | Fixed top-right viewport; mounted from `src/routes/+layout.svelte`. |
| `apps/web/src/lib/privacy/amount-privacy-store.ts` | Session-backed **anonymize** toggle (`sessionStorage`): mask monetary values across wealth UI; PIN verified via `POST /settings/privacy/verify-amount-reveal-pin` (PIN set under **Settings → Security**). |
| `apps/web/src/lib/privacy/format-amount.ts` | `formatMaskedMoney` / `formatMaskedNumber` helpers for privacy mode. |
| `apps/web/src/lib/formatting/instrument-display-label.ts` | `formatInstrumentDisplayLabel` — primary wealth UI label `Name (TICKER)`. |
| `apps/web/src/lib/formatting/percent-display.ts` | `formatPortfolioAllocationPercent`, `formatUnitRateAsPercent2`, `formatNumberAsPercent2` — percentages to 2 decimals. |
| `apps/web/src/lib/formatting/matched-lot-realised-pnl-percent.ts` | FIFO lot realised P/L as % of matched cost basis. |
| `apps/web/src/lib/components/PnlMoneyWithArrow.svelte` | Currency P/L: **coloured arrows only**; amount (and optional `(pct%)`) use neutral text; supports privacy mask. |
| `apps/web/src/lib/charts/register-chart-js.ts` | Tree-shaken **Chart.js** registration: pie, line (with **Filler** for areas), bar — used by dashboard and performance charts. |
| `apps/web/src/lib/charts/chart-theme.ts` | **Recharts-like** Chart.js defaults: reads `--chart-*`, `--border`, `--muted-foreground`, `--card`, `--popover` from `theme.css`; tooltip/grid/tick helpers (`readChartThemePalette`, `buildChartJsTooltipTheme`, etc.). |
| `apps/web/src/lib/components/PieChartPanel.svelte` | Themed Chart.js **pie** in a card shell (dashboard asset mix, sector). |
| `apps/web/src/lib/components/LineChartPanel.svelte` | Themed Chart.js **line** with area fill (dashboard portfolio growth). |
| `apps/web/src/lib/components/AreaChartPanel.svelte` | Themed **area** chart (performance portfolio value over time; gradient fill). |
| `apps/web/src/lib/components/BarChartPanel.svelte` | Themed **bar** chart (TWR %, cash-flow deposits vs withdrawals). |
| `apps/web/src/lib/components/PinRevealDialog.svelte` | Modal to verify PIN before revealing amounts (DB-146). |
| `apps/web/src/routes/settings/+page.svelte` | Full-page **Settings**: profile, investing preferences (risk score / ESG copy, searchable sector multi-select), Anthropic API key (model from `API_AI_MODEL_ANTHROPIC`), security (password + amount-reveal PIN). |
| `apps/web/src/lib/components/SearchableSectorMultiSelect.svelte` | Filterable list + chips for **sectors to avoid** (preferences JSON array). |
| `apps/web/src/lib/domain/investment-sector-options.ts` | Static sector label list for the multi-select. |
| `apps/web/src/lib/domain/allowed-currency-codes.ts` | Allowed ISO currency codes for header selector; must match API `currency-codes.ts`. |
| `apps/web/src/lib/components/SimpleLineChart.svelte` | Single line chart (e.g. asset price history); uses shared chart theme. |
| `apps/web/src/routes/dashboard/+page.svelte` | **Portfolio Overview** (prototype-style): snapshot KPIs (value, cost basis, active alerts, P/L, freshness), asset-type + sector pies, portfolio growth line, recent transactions, priority recommendations, top holdings; Chart.js + `chart-theme` (hidden when anonymized). |
| `apps/web/src/lib/api/recommendations.ts` | Typed client helpers for recommendation endpoints. |
| `apps/web/src/lib/realtime/recommendation-runs-feed.ts` | Browser WebSocket client for recommendation run events: reconnect/backoff, connection state, and reconnect reconciliation hook. |
| `apps/web/src/routes/recommendations/+page.svelte` | Recommendation run history and “Run recommendation” action; realtime list updates via WebSocket events (no interval polling loop), auto-timeout display, and per-card three-dots actions (`Cancel run` for processing, otherwise `Delete`). |
| `apps/web/src/routes/recommendations/[runId]/+page.svelte` | Single run detail (findings + items) with realtime status updates via WebSocket and reconnect reconciliation. |
| `apps/web/src/routes/assets/+page.svelte` | Holdings table (snapshot positions × assets); filter active/archived; links to asset detail. |
| `apps/web/src/routes/assets/[assetId]/+page.svelte` | Asset drill-down: snapshot metrics, manual price chart, FIFO lot links, transaction list. |
| `apps/web/src/routes/ledger/+page.svelte` | Transaction list with filters, include-deleted, add/edit modal, soft-delete confirmation (DB-95); columns **Asset name** + **Symbol**. |
| `apps/web/src/routes/performance/+page.svelte` | **Performance Analytics** (prototype-style): TWR range filter, KPI cards, area + bar charts (`AreaChartPanel`, `BarChartPanel`), period-by-period table (`externalCashFlowsAmount` for cash-flow bars). |
| `apps/web/package.json` | Depends on **`chart.js`** (ADR-010 charts). |

## Services

| Path | Description |
|------|-------------|
| `services/api/` | Fastify backend REST API (Node.js/TypeScript). Entry: `src/index.ts`. Scripts: `dev` (tsx watch), `build` (tsc), `start`, `lint`, `clean`. Build output: `dist/`. Package **`exports`**: `api/jobs/daily-market-prices` (worker bundle). Modules live under `src/modules/` (health + domain modules per `docs/architecture.md`). |
| `services/api/src/config/get-dynamo-db-config.ts` | DynamoDB settings from env (`API_DYNAMODB_*`, region fallbacks); required for the API. |
| `services/api/src/config/get-api-node-environment.ts` | Effective API mode: `API_NODE_ENV` ?? `NODE_ENV` ?? `development` (lowercase); `isApiProductionEnvironment()` for prod-only behavior. |
| `services/api/src/config/get-analysis-report-storage-config.ts` | Analysis report S3: `API_REPORTS_BUCKET_NAME` or default `{API_DYNAMODB_TABLE_NAME}-analysis-reports`; optional `API_REPORTS_S3_DISABLED`; region aligns with `API_DYNAMODB_REGION` / AWS region env. |
| `services/api/src/config/build-api-pino-logger-options.ts` | Fastify/Pino logger options: JSON to stdout (`message` key), `service` + `environment` base fields, redaction for cookies/auth/password paths; level from `API_LOG_LEVEL` or prod/non-prod default. |
| `services/api/src/modules/logging/logging-module.ts` | Structured HTTP logs (`http_request_start` / `http_request_complete`), `request_error` hook (stack only non-prod), `x-request-id` response header; `userId` on completion when `request.authUser` is set. |
| `services/api/src/config/get-auth-config.ts` | Session cookie name/TTL, login rate limits, cookie `Secure` flag (uses `getApiNodeEnvironment()`). |
| `services/api/src/server/register-openapi-schema.ts` | Non-production: registers `@fastify/swagger` so routes contribute to the OpenAPI document. |
| `services/api/src/server/register-openapi-ui.ts` | Non-production: registers `@fastify/swagger-ui` at `/api-docs` (e.g. `/api-docs/json` for the spec). |
| `services/api/src/db/create-dynamo-db-client.ts` | Factory for `DynamoDBClient` (optional custom endpoint for tools like LocalStack). |
| `services/api/src/modules/auth/` | Username/password auth: `auth-plugin.ts` (Fastify plugin), DynamoDB `USER_ACCOUNT` / `USER_SESSION` items, `POST /auth/login`, `POST /auth/logout`, `POST /auth/change-password`, `GET /auth/session`, `requireSession` pre-handler. |
| `services/api/src/modules/domain/` | Shared domain helpers: DynamoDB key builders (`domain-keys.ts` includes recommendation SK helpers), API error bodies, allowed currency codes; `domain-data-plugin.ts` registers portfolio (+ versioned config), assets, ledger, valuations, **market price job status**, snapshots, performance, **AI settings**, **recommendations routes** (depends on `auth-domain`). |
| `services/api/src/config/get-ai-settings-encryption-key.ts` | Derives AES key material from `API_AI_SETTINGS_SECRET` (SHA-256); when unset, `/settings/ai` persistence returns a configuration error. |
| `services/api/src/modules/ai/` | Anthropic-only AI settings (DB-114): `user-ai-settings-repository.ts` (`USER#…` / `USER_SETTINGS#AI`), `ai-settings-cipher.ts` (AES-256-GCM), `resolve-ai-model-id.ts` (`getResolvedAnthropicModelId` / `API_AI_MODEL_ANTHROPIC`), `verify-ai-provider-connection.ts` (Anthropic key check), `ai-settings-service.ts`, `register-ai-settings-routes.ts` — `GET/PUT /settings/ai` (body: optional `apiKey` only), `POST /settings/ai/verify`. |
| `services/api/src/config/get-privacy-pepper.ts` | Pepper for amount-reveal PIN hashing: `API_PRIVACY_SECRET` or fallback `API_AI_SETTINGS_SECRET`. |
| `services/api/src/modules/privacy/` | `user-privacy-settings-repository.ts` (`USER_SETTINGS#PRIVACY`), `privacy-settings-service.ts` (scrypt hash `pepper:pin`), `register-privacy-settings-routes.ts` — `GET /settings/privacy`, `PUT /settings/privacy/amount-reveal-pin`, `POST /settings/privacy/verify-amount-reveal-pin`. |
| `services/api/src/modules/portfolio/` | Portfolio: `portfolio-repository.ts`, `portfolio-service.ts`, `register-portfolio-domain-routes.ts` (`GET/PATCH /portfolio`); versioned recommendation config: `portfolio-config-repository.ts`, `portfolio-config-service.ts`, `register-portfolio-config-routes.ts` — `GET/PUT /portfolio/config`, `GET /portfolio/config/versions` (DynamoDB `PORTFOLIO_CFG#V…` + `PORTFOLIO_CFG#ACTIVE` under portfolio-scoped PK). |
| `services/api/src/modules/assets/` | Assets (STOCK/ETF): `asset-repository.ts`, `asset-service.ts`, `register-assets-routes.ts` — `GET/POST /assets`, `PATCH /assets/:assetId` (optional `primaryPriceProviderKey`; new assets start **unset**; daily job sets `YAHOO_FINANCE` after a successful Yahoo quote). |
| `services/api/src/modules/market-prices/` | DB-150 market ingestion: `price-provider-keys.ts`, Yahoo quotes via **`yahoo-finance2`** (`yahoo-finance-v7-quote-fetcher.ts`, batches of 12, 750ms between batches, retry; replaces raw `v7/finance/quote` HTTP which often returns 401), `stub-crypto-quote-provider.ts` (future slot), `daily-market-price-job.ts` (tries Yahoo for active STOCK/ETF with **no** or **Yahoo** provider; on first successful quote, persists `primaryPriceProviderKey: YAHOO_FINANCE`), `market-price-job-state-repository.ts` (`OPS#MARKET_PRICE`), `register-market-price-routes.ts` — `GET /market-prices/status`, `POST /market-prices/run` (invokes `executeDailyMarketPriceJob`, same as worker CLI). |
| `services/api/src/jobs/daily-market-prices.ts` | `executeDailyMarketPriceJob` — shared by `pnpm daily:market-prices` and `workers/worker`; discovers **all active** users via `UserAccountRepository.listAllActiveUserIds()` unless `BADGERS_MARKET_PRICE_USER_IDS` is set. |
| `services/api/src/modules/ledger/` | Ledger + FIFO: `transaction-repository.ts`, `ledger-service.ts`, `fifo-holdings-service.ts`, `lot-link-repository.ts`, `register-ledger-routes.ts` — `GET/POST/PATCH/DELETE /transactions`, `GET /holdings`. Ledger mutations notify `SnapshotInvalidationService` (optional dependency) to set `earliestAffectedDate`. |
| `services/api/src/modules/valuations/` | Prices: `price-snapshot-repository.ts` (optional `dataQuality`, `rawPayloadHash`), `price-snapshot-service.ts` (manual blocked when asset has `primaryPriceProviderKey`), `register-valuations-routes.ts` — `POST /prices/manual`, `GET /prices`, `GET /prices/latest` (DynamoDB `PRICE_SNAPSHOT` items under portfolio PK). |
| `services/api/src/modules/snapshots/` | Derived snapshots: `snapshot-state-repository.ts` (`SNAPSHOT_STATE`), `position-snapshot-repository.ts` (query by snapshot date), `portfolio-snapshot-repository.ts` (includes `getLatest`), `performance-snapshot-repository.ts`, `snapshot-invalidation-service.ts`, `snapshot-rebuild-service.ts`, `snapshot-date-utils.ts` (includes `addUtcMonthsYmd`), `snapshot-purge.ts`, `register-snapshots-routes.ts` — `GET /snapshots/latest`, `GET /snapshots/status`, `POST /snapshots/rebuild`. |
| `services/api/src/modules/performance/` | TWR: `twr-daily-v1.ts`, `resolve-twr-query-bounds.ts` (range presets vs `from`/`to`), specs, `register-performance-routes.ts` — `GET /performance/twr`. |
| `services/api/src/modules/recommendations/` | Recommendation vertical slice: `build-recommendation-analytics-payload.ts`, `evaluate-recommendation-rules.ts`, `baseline-deterministic-recommendations.ts`, `anthropic-recommendation-llm-adapter.ts` (official `@anthropic-ai/sdk`), `llm-recommendation-client.ts`, `coerce-llm-json-text.ts` (markdown fence + balanced-object extraction before parse), `ai-recommendation-output.ts`, `recommendation-job-queue-repository.ts` (Dynamo rollback queue path), `recommendation-run-service.ts` (async `PROCESSING` orchestration + SQS processor dispatch when configured, stale `PROCESSING` auto-timeout after 10 minutes), `instantiate-recommendation-run-service.ts` (shared wiring for API + scripts), `recommendation-run-repository.ts` (Dynamo `RECOMMENDATION_RUN`, `RULE_FINDING`, `RECOMMENDATION_ITEM`), `register-recommendations-routes.ts` — `POST /recommendations/runs`, `GET /recommendations/runs`, `GET /recommendations/runs/:id`, `GET /recommendations/latest-summary` (first **completed** run in recent window), `POST /recommendations/runs/cancel-all-processing`, `DELETE /recommendations/runs/timeouts`. |
| `services/api/src/modules/analysis/` | Explore/Library analysis runs (DB-148 / DB-171 / DB-172): `analysis-types.ts`, `analysis-run-repository.ts`, `analysis-computation-error.ts` (`COMPUTATION_ERROR`), `build-analysis-report-storage-key.ts` (object key + **`buildAnalysisReportBundleFolderPrefix`** → `{type}-{isoUtc}-{subject}/`), `build-analysis-report-summary-sentence.ts`, `fetch-yahoo-instrument-display-name.ts`, `fetch-technical-analysis-market-data.ts` (Yahoo OHLCV + quote), `technical-analysis-thresholds.ts`, `bundle-chart-context.ts` (tail series for charts, not in LLM JSON), `fractal-pivots.ts` (AC7 fractals + Fib swing leg), `compute-technical-analysis-payload.ts` (returns `{ payload, chartContext }`), `build-sparkline-svg.ts`, `build-technical-analysis-chart-svgs.ts` (labeled MACD/RSI/Bollinger/volume/OBV/SMA/ATR/Fib SVGs), `technical-analysis-chart-embed.ts` (LLM figure instructions + **Appendix** only for unreferenced `assets/*`), `technical-analysis-bundle.ts` (`report.md` + `manifest.json` + `assets/*` for every report type; TA adds `payload.json` + chart SVGs), `load-bundle-manifest-from-s3.ts`, `presign-analysis-bundle-assets.ts`, `analysis-run-service.ts`, `register-analysis-routes.ts` — `POST/GET /analysis/runs` (422 on computation errors), `GET /analysis/reports`, `GET /analysis/reports/:id` (presigned `bundleAssetUrls` when bundle metadata present), `GET /analysis/reports/:id/export`. |
| `services/api/src/lambda-recommendation-processor-handler.ts` | SQS Lambda handler for recommendation jobs; reuses `instantiateRecommendationRunService` and processes batch records with partial-batch failure responses. |
| `services/api/src/modules/realtime/realtime-plugin.ts` | Registers `@fastify/websocket` and exposes `/realtime/ws`; pushes both recommendation and analysis run status-change events per authenticated session (connection/degraded + run lifecycle deltas). |
| `services/api/src/modules/ai/resolve-user-ai-credentials.ts` | Decrypts `USER_SETTINGS#AI` for server-side recommendation LLM calls. |
| `services/api/src/modules/health/dynamo-db-health-service.ts` | Readiness: `DescribeTable` on the configured table. |
| `services/api/src/scripts/dynamodb-smoke-write.ts` | Dev CLI: put+delete smoke item; run via `pnpm dynamodb:smoke-write` from repo root. |
| `services/api/src/scripts/process-recommendation-queue.ts` | Drains queued recommendation jobs (`pnpm --filter api recommendation-queue:process`); use `pnpm --filter api recommendation-queue:watch` for continuous local draining in fallback mode. |
| `services/api/src/scripts/put-dev-user.ts` | CLI: upsert `user_account` in the table from `API_DYNAMODB_TABLE_NAME` using `BOOTSTRAP_USERNAME` / `BOOTSTRAP_PASSWORD`; preserves `userId` when updating; run via `pnpm bootstrap:user`. |
| `services/api/src/scripts/seed-dev-wealth-demo.ts` | CLI: **destructive** demo seed for the bootstrap user’s portfolio — wipes portfolio-scoped items except `PORTFOLIO_CFG*`, creates ~10 US equities/ETFs (**unset** `primaryPriceProviderKey` until daily job adopts Yahoo), ~2 years of BUY/SELL/DIVIDEND, weekly seeded prices (`SEED_DEV_WEALTH`), FIFO lot links, and runs a full snapshot rebuild. Requires existing `user_account`; run `pnpm seed:dev-wealth` from repo root (uses root `.env`). |
| `services/api/src/scripts/run-daily-market-prices.ts` | CLI: `executeDailyMarketPriceJob` — `pnpm --filter api daily:market-prices` (root `.env`). |

## Workers

| Path | Description |
|------|-------------|
| `workers/worker/` | Daily worker runtime (`src/index.ts`, `src/lambda-handler.ts`) — runs `executeDailyMarketPriceJob` from **`api/jobs/daily-market-prices`** (workspace dependency; requires `pnpm --filter api build` before bundling). Recommendation processor runtime is deployed from API bundle (`services/api/src/lambda-recommendation-processor-handler.ts`). |

**Production:** Web, API, and worker are **not** built as container images in-repo (no `Dockerfile`s under those paths). CI/CD publishes static assets and Lambda bundles; see ADR-012 in `docs/architecture-decision-records.md` and `.github/workflows/deploy-prod.yml`.

## Shared

| Path | Description |
|------|-------------|
| `shared/typescript/base/` | Shared TypeScript configs: `base.json` (strict, ESNext), `node.json` (Node/backend), `svelte.json` (Svelte/ browser). Consumed by apps, services, and workers via `extends`. Package: `@badgers-investments/tsconfig-base`. |

## Infrastructure

| Path | Description |
|------|-------------|
| `infra/terraform/bootstrap/` | Remote state bucket + state-lock DynamoDB table. |
| `infra/terraform/envs/dev/` | Terraform workspace for **dev** application DynamoDB (`badgers-investments-dev` by default; mirrors prod `…-prod` naming) and **dev** S3 analysis reports bucket (`analysis_reports_bucket_id`). |
| `infra/terraform/envs/prod/` | Production stack: **Route53 zone** (`dns_zone_name`) + ACM + aliases, S3 + CloudFront, API Gateway + Lambda, daily worker Lambda, recommendation processor Lambda + SQS/DLQ/event source mapping + alarms, Secrets Manager, OIDC role. |
| `infra/terraform/modules/public_dns_zone/` | Single public Route53 hosted zone (apex); outputs `zone_id` + delegation `name_servers`. |
| `infra/terraform/modules/static_site/` | S3 static bucket + CloudFront + ACM (us-east-1) for `web_domain` (Route53 records when `route53_zone_id` set). |
| `infra/terraform/modules/analysis_reports_bucket/` | Private S3 bucket for Explore/Library report bundles (SSE-S3, block public access); used by dev and prod stacks with distinct bucket names. |
| `infra/terraform/modules/api_lambda/` | API Lambda, HTTP API, regional ACM + custom domain for `api_domain` (Route53 records when `route53_zone_id` set). Module variable `api_node_env` (default `production`) sets `API_NODE_ENV` / `NODE_ENV`; optional `api_ai_model_anthropic` sets `API_AI_MODEL_ANTHROPIC`. Optional `api_reports_bucket_name` sets `API_REPORTS_BUCKET_NAME` and S3 IAM on the Lambda role. Sensitive env vars `COOKIE_SECRET`, `API_AI_SETTINGS_SECRET`, `API_PRIVACY_SECRET` are passed from the caller (same strings as `secrets` module / SM JSON) so plan does not read a stale secret version. |
| `infra/terraform/modules/worker_lambda/` | Worker runtime module: daily worker Lambda + EventBridge schedule, recommendation processor Lambda + SQS queue/DLQ + event source mapping + queue health alarms. |
| `infra/terraform/modules/app-dynamodb-table/` | Reusable on-demand DynamoDB table (`PK` / `SK`, optional **`GSI1`** mirroring prod). |
| `infra/terraform/modules/secrets/` | AWS Secrets Manager application secret: single JSON payload (`COOKIE_SECRET`, `API_AI_SETTINGS_SECRET`, `API_PRIVACY_SECRET`) from Terraform `random_password` resources so applies do not drop ad hoc keys. |

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
- `pnpm bootstrap:user` — Upsert a dev `user_account` row (requires `BOOTSTRAP_USERNAME`, `BOOTSTRAP_PASSWORD`, and DynamoDB env vars).
- `pnpm infra:dev:init` / `pnpm infra:dev:apply` — Create **dev** app DynamoDB table via Terraform (requires `infra/terraform/envs/dev/backend.hcl`; see `backend.hcl.example`).
