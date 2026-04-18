# Badgers Investments — ADR Pack (MVP Architecture Decisions)

## ADR-000 Index

This pack contains the initial Architecture Decision Records (ADRs) for the MVP.

### Included ADRs
- ADR-001 — Frontend/Backend Split and Backend Module Boundaries
- ADR-002 — Deployment Topology on AWS ECS Fargate (**superseded** by ADR-012)
- ADR-012 — Serverless Production on AWS (S3/CloudFront + API Gateway + Lambda)
- ADR-003 — Snapshot-First Data Architecture and Rebuild Invalidation Policy
- ADR-004 — Multi-Currency and FX Handling for `TWR_DAILY_V1`
- ADR-005 — Recommendation Orchestration and Deduplication
- ADR-006 — Passwordless Email OTP Authentication via AWS SES
- ADR-011 — Username/Password Authentication (Supersedes ADR-006)
- ADR-007 — DynamoDB-Backed Cookie Session Strategy
- ADR-008 — User-Configured LLM Recommendation Integration and Validation Pipeline
- ADR-009 — API Style and Frontend Integration (REST JSON + Typed DTOs)
- ADR-010 — Charting and Observability Baseline (Chart.js + CloudWatch Logs)
- ADR-013 — Analysis Report Bundles (DynamoDB Metadata + S3 Canonical Content + Sidecar Assets)
- ADR-014 — Market Prices: Yahoo Finance as Primary Provider (Listed Equities/ETFs)

---

## ADR-001 — Frontend/Backend Split and Backend Module Boundaries
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
You selected a separate frontend and backend architecture rather than a SvelteKit monolith.

### Decision
Use:
- **Svelte** frontend (separate app)
- **Node.js + TypeScript + Fastify** backend API

Backend is a **modular monolith** (single codebase/runtime per service, internal module boundaries).

### Backend Modules (MVP)
- `auth`
- `sessions`
- `portfolio`
- `assets`
- `ledger`
- `valuations`
- `snapshots`
- `performance`
- `recommendations`
- `rules`
- `ai`
- `jobs`
- `logging`

### Rationale
- Clear API boundary
- Better fit for separate web static hosting, API, and worker runtimes
- Stronger separation of UI and financial logic

### Consequences
**Positive**
- Easier testing and future extraction
- Cleaner responsibilities

**Negative**
- More local/dev and deployment complexity than a monolith
- Need CORS/cookie configuration discipline

---

## ADR-002 — Deployment Topology on AWS ECS Fargate
- **Status:** Superseded (see **ADR-012**)
- **Date:** 2026-02-23

### Context
Production must be AWS-hosted, HTTPS-enabled, and simple to operate.

### Decision (historical)
Use **AWS ECS Fargate** for production compute.

### MVP Topology
- Frontend container service (Svelte)
- Backend API container service (Fastify)
- Worker container/task
- Amazon DynamoDB
- EventBridge for schedules
- Secrets Manager + KMS for secrets
- CloudWatch Logs for logging

### Job Execution Pattern
**Hybrid**
- Interactive recommendation runs: synchronous via API (fast UX)
- Scheduled jobs: EventBridge → worker
- Heavy rebuilds/backfills: worker
- UI/API can trigger worker-compatible handlers directly

### Rationale
- Managed container runtime without VM ops
- Clean support for API + worker split

---

## ADR-012 — Serverless Production on AWS (S3/CloudFront + API Gateway + Lambda)
- **Status:** Accepted
- **Date:** 2026-04-09

### Context
Production should minimize fixed cost and operational surface area. Container registries and long-lived ECS services are no longer the target topology.

### Decision
Use a **serverless-oriented** production stack on AWS:

- **Static SPA:** S3 origin + CloudFront + ACM (us-east-1) for `web_domain`.
- **API:** **Amazon API Gateway HTTP API** (v2) with **AWS Lambda** (Node.js 20) running Fastify via **`@fastify/aws-lambda`**; regional ACM + custom domain for `api_domain` where DNS is managed.
- **Worker:** **EventBridge** schedule invoking a **Lambda** function (batch/snapshot jobs).
- **Data / ops:** **DynamoDB** (existing table name wired in Terraform), **Secrets Manager** for app secrets (e.g. cookie signing), **CloudWatch Logs** for Lambdas.

CI/CD (GitHub Actions OIDC) publishes **Lambda zip** artifacts and **`aws s3 sync`** for static files, then **CloudFront invalidation**.

### Consequences
- **Positive:** No ECR/ECS to operate; scale-to-zero friendly pricing for low traffic.
- **Positive:** Aligns with DynamoDB + session cookie API already in use.
- **Tradeoff:** Cold starts and API Gateway/Lambda limits vs containers; CORS explicit for browser (`CORS_ORIGIN` / `@fastify/cors`).

---

## ADR-003 — Snapshot-First Data Architecture and Rebuild Invalidation Policy
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
You selected:
- editable transactions
- full snapshot layer from day one
- ledger as source of truth

### Decision
Use a **snapshot-first architecture** while keeping canonical truth in:
- transaction ledger
- price/manual valuation records
- FX snapshots

Persist derived tables (MVP):
- `position_snapshot`
- `portfolio_snapshot`
- `performance_snapshot`

### Invalidation Policy
Track **`earliest_affected_date`** on mutations that impact derived outputs:
- transaction create/update/delete
- manual valuation changes
- FX rate changes
- price corrections (if supported)

### Rebuild Rule
Recompute forward from `earliest_affected_date` for:
- position snapshots
- portfolio snapshots
- performance snapshots

Recommendation runs after the affected point may be marked stale-input (optional, recommended).

### Rationale
- Fast reads for dashboard/recommendations
- Deterministic rebuild path despite editable history

---

## ADR-004 — Multi-Currency and FX Handling for `TWR_DAILY_V1`
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
MVP must support multiple major currencies and daily TWR.

### Decision
Support multi-currency in MVP using:
- asset-native prices/valuations
- **daily FX snapshots**
- base-currency conversion during snapshot generation and TWR calculations

### Allowed Currency Set (MVP)
- USD, EUR, JPY, GBP, CNY, CHF, AUD, CAD, HKD, NZD

### FX Entry Strategy
Use a **Daily FX table entry UI** (manual-first) in MVP.

### TWR FX Policy
`TWR_DAILY_V1` uses daily FX rates aligned to the valuation date.

### Missing FX Handling
If required FX is missing:
- snapshots for affected day are incomplete
- recommendation quality degrades or run is blocked (implementation policy; default degrade + flag)

### Rationale
- Matches explicit multi-currency requirement
- Consistent with daily TWR
- Works before provider integrations exist

---

## ADR-005 — Recommendation Orchestration and Deduplication
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
Recommendations are AI-powered, but deterministic rules/scoring remain authoritative. Same-input runs should be deduplicated.

### Decision
Implement the following orchestration flow:

1. Validate preconditions
2. Build valuation context (prices/manual valuations/FX)
3. Ensure snapshots exist / rebuild if needed
4. Build deterministic analytics payload
5. Evaluate hard-coded rules
6. Compute deterministic scores and baseline actions
7. Compute stable `analytics_input_hash`
8. Deduplicate same-input runs
9. Invoke configured LLM provider
10. Validate AI output
11. Persist run + findings + items
12. Return result

### AI / LLM policy
When AI is included in a run, the **user-configured LLM** is the primary synthesis path (see `ai` module). Deterministic rules and scores remain authoritative.

### Deterministic Score Policy
Deterministic scores are source of truth.
AI may explain, but not override authoritative scores.

### Deduplication Key (MVP)
Use a key derived from:
- `portfolio_id`
- `config_version_id`
- `analytics_input_hash`
- recommendation engine version identifiers (rules/prompt versions)

### Rationale
- Prevents duplicate AI calls
- Preserves reproducibility
- Keeps scoring consistent across model changes

---

## ADR-006 — Passwordless Email OTP Authentication via AWS SES
- **Status:** Superseded (see ADR-011)
- **Date:** 2026-02-23

### Context
Authentication was changed from password/TOTP to **Email OTP only (passwordless)**.

### Decision
Use **passwordless email OTP authentication** delivered via **AWS SES**.

### Login Flow (MVP)
1. User submits email address
2. System creates OTP challenge
3. OTP sent via SES
4. User submits OTP
5. OTP verified
6. Server-side session created (cookie-based)

### Security Rules
- OTP stored as **hash**, never plaintext
- Short expiry (e.g., 5–10 minutes)
- Single-use only
- Attempt limits
- Basic rate limiting on request + verify endpoints

### Required Data Model Changes
- `user_account` uses `email` as unique login identifier
- Remove password fields from `user_account`
- Remove `user_totp_secret`
- Add `auth_otp_challenge`
- Add `user_session` (see ADR-007)

### `auth_otp_challenge` (recommended fields)
- `id` (UUID, PK)
- `user_id` (UUID, FK, nullable for bootstrap if needed)
- `email` (varchar, not null)
- `otp_code_hash` (varchar, not null)
- `purpose` (varchar, not null, e.g. `LOGIN`)
- `expires_at` (timestamptz, not null)
- `consumed_at` (timestamptz, nullable)
- `attempt_count` (int, default 0)
- `max_attempts` (int, default 5)
- `created_at` (timestamptz, not null)
- `sent_via_provider` (varchar, nullable; `SES`)
- `provider_message_id` (varchar, nullable)

### Rationale
- Matches explicit auth choice
- Removes password/TOTP management overhead
- Fits AWS stack via SES

---

## ADR-007 — DynamoDB-Backed Cookie Session Strategy
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
You chose cookie-based server sessions with DynamoDB-backed storage.

### Decision
Use **server-side sessions stored in Amazon DynamoDB**, with an opaque session ID in a secure cookie.

### `user_session` (recommended fields)
- `id` (UUID or opaque token id, PK)
- `user_id` (UUID, FK → `user_account.id`, not null)
- `created_at` (timestamptz, not null)
- `last_seen_at` (timestamptz, not null)
- `expires_at` (timestamptz, not null)
- `ip_address` (inet, nullable)
- `user_agent` (text, nullable)
- `is_revoked` (boolean, default false)
- `revoked_at` (timestamptz, nullable)

### Cookie Security Requirements
- `HttpOnly`
- `Secure` (prod)
- `SameSite` appropriate to frontend/backend deployment pattern
- explicit expiry/timeout policy

### Rationale
- Avoids adding Redis in MVP
- Works reliably with stateless API compute (e.g. Lambda): sessions live in DynamoDB, not process memory
- Enables server-side revocation/logout

---

## ADR-008 — User-Configured LLM Recommendation Integration and Validation Pipeline
- **Status:** Accepted (amended 2026-04-14: model-agnostic, user-configured provider)
- **Date:** 2026-02-23

### Context
Recommendation synthesis uses an external LLM. The product uses a **user-configured provider and model** (e.g. OpenAI, Anthropic, Google Gemini), not a single hard-coded vendor.

### Decision
Implement LLM integration in backend **`ai` module** with:
- **Provider selection and API keys** stored per user (see Settings / FR-SET-*)
- **Model id** resolved from user settings and/or deployment defaults (`API_AI_MODEL_*` env per provider family where applicable)
- **Small provider-specific adapters** (HTTP/SDK) behind a consistent “synthesis request” contract

### Rules
- Prompt templates/version IDs live in code (provider-agnostic prompt contract to the model)
- Deterministic analytics/rules/scoring run before LLM call
- LLM output must be strict JSON (or parseable to expected JSON)
- Backend validates output before persistence/use

### Validation (minimum)
- parseable JSON
- required fields present
- enum values valid
- referenced asset IDs exist in current run context
- deterministic scores remain authoritative

### Rationale
- Matches user-owned keys and model choice
- Keeps validation and orchestration in one module
- Adding a provider means extending `ai`, not scattering HTTP calls

---

## ADR-009 — API Style and Frontend Integration (REST JSON + Typed DTOs)
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
Frontend and backend are separate apps. You selected REST JSON with typed DTOs.

### Decision
Use **REST JSON** APIs exposed by Fastify, with **typed client DTOs** for frontend integration.

### Conventions (MVP)
- JSON request/response
- resource-oriented endpoints where practical
- explicit action endpoints for domain operations
- consistent error envelope
- request/correlation IDs recommended

### Example Endpoints
- `POST /auth/login`
- `POST /auth/logout`
- `GET /assets`
- `POST /transactions`
- `PATCH /transactions/:id`
- `POST /snapshots/rebuild`
- `POST /recommendations/runs`
- `GET /recommendations/runs/:id`

### Frontend State
Use **Svelte stores only** (per explicit decision), with typed API client functions.

### Rationale
- Boring, explicit, and easy to debug
- Strong fit for Fastify + Svelte MVP

---

## ADR-010 — Charting and Observability Baseline (Chart.js + CloudWatch Logs)
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
You selected Chart.js and a lightweight logging/observability approach.

### Decision (Charts)
Use **Chart.js** for MVP charts:
- allocation
- portfolio value/performance
- P/L trends
- asset price history

### Decision (Observability)
Use a lightweight baseline:
- structured logs to stdout/stderr
- **CloudWatch Logs** in production
- request correlation IDs for API
- job/run IDs for worker logs

### Logging Scope (MVP)
- request logs
- error logs
- job execution logs
- lightweight mutation logs (no full audit trail)

### Rationale
- Fast implementation
- Sufficient operational visibility for personal-use MVP

---

## ADR-011 — Username/Password Authentication (Supersedes ADR-006)
- **Status:** Accepted
- **Date:** 2026-02-28

### Context
The MVP authentication requirement changed from passwordless email OTP (ADR-006) to a standard username/password login, while keeping DynamoDB-backed cookie sessions (ADR-007).

### Decision
Use **username + password** authentication for the single user.

### Rules
- Passwords are stored as a one-way **hash** in the database (`user_account.password_hash`).
- Never store or log plaintext passwords.
- Login uses a single endpoint `POST /auth/login` which verifies credentials and creates a server-side session (ADR-007).
- Invalid credentials return a **generic** authentication failure message (no factor disclosure).
- Apply basic rate limiting to the login endpoint.

### Rationale
- Removes external dependency on email delivery for basic access.
- Matches the updated MVP requirement for deterministic local/dev access.
- Keeps the session strategy unchanged and compatible with the production API on Lambda (ADR-007, ADR-012).

### Consequences
**Positive**
- Works offline/local without email provider setup.
- Simpler end-user flow for a single-user app.

**Negative**
- Requires secure password hashing and handling.
- Requires a password bootstrap/reset strategy (single-user ops decision).

---

## ADR-013 — Analysis Report Bundles (DynamoDB Metadata + S3 Canonical Content + Sidecar Assets)
- **Status:** Accepted
- **Date:** 2026-04-17

### Context
Analysis tools (Technical Analysis, Portfolio Builder, and future Explore tools) must persist **rich reports**: markdown narrative plus **binary sidecar assets** (charts, diagrams, indicator plots, exported tables as images). Storing full markdown bodies and large blobs in DynamoDB does not scale (item size limits, query cost) and duplicates the role of object storage.

### Decision
1. **DynamoDB** stores **index metadata only** for each `ANALYSIS_REPORT` row: identifiers, type, title, short summary for lists, timestamps, creator, and **pointers** to the canonical bundle (S3 prefix and/or manifest key). It must **not** be the long-term source of truth for full report content once migration is complete.
2. **Amazon S3** stores the **immutable report bundle** per run under a stable prefix, including:
   - primary markdown body,
   - a small **manifest** (JSON, versioned) describing the body path and **assets** (id, relative path, MIME type, optional dimensions/role),
   - **`assets/*`** for rasters/SVGs/PDFs referenced from markdown via relative paths.
3. **Generation:** Combine LLM narrative with **deterministic** rendering where possible for financial charts (e.g. RSI, MACD, Bollinger) so outputs are reproducible; all emitted files are uploaded into the bundle and listed in the manifest.
4. **Serving:** APIs return list rows from Dynamo; **detail** loads markdown from S3 (directly or via API streaming). Asset URLs MUST be **session-scoped** — authenticated proxy routes and/or **short-lived presigned GET** URLs — never long-lived public object URLs embedded in stored markdown.
5. **Rendering:** Library (and similar UIs) convert markdown to HTML with a sanitizer; image `src` values resolve through the manifest to trusted URLs only.

### Rationale
- Aligns object size and cost with S3; keeps Dynamo queries fast for tables and filters.
- Supports non-text artifacts required for credible technical analysis.
- Clear security boundary for user-scoped blobs.

### Consequences
**Positive**
- Scales to larger reports and many assets.
- Reproducible, inspectable bundles for debugging and future re-rendering.

**Negative**
- Requires migration from today’s `markdownBody`-on-item pattern where it exists.
- Additional moving parts (manifest schema, proxy or presigning, cache headers).

### Migration (recommended)
- Dual-write bundles to S3 + metadata while UI/API switches to fetch-from-S3.
- Backfill historical rows; then stop persisting full body in Dynamo.

---

## ADR-014 — Market Prices: Yahoo Finance as Primary Provider (Listed Equities/ETFs)
- **Status:** Accepted
- **Date:** 2026-04-18

### Context
The product needs automatic **market prices** for stocks and ETFs beyond manual entry, with a **cost-conscious** MVP and a clear place to plug additional asset classes later. Earlier planning referenced **Alpha Vantage**; the product direction is now to standardize on **Yahoo Finance** as the primary upstream for listed equity/ETF quotes.

### Decision
1. Use **Yahoo Finance** as the **default/primary** source for **stock and ETF** daily (or batch) quotes, accessed through a **server-side adapter** in the API/worker (not from the browser).
2. Persist ingested values as **`price_snapshot`** rows with explicit **provenance** (provider key/metadata), reusing existing snapshot invalidation when prices change.
3. Keep a **provider abstraction** (fetch quote / daily close) so **other** sources (e.g. crypto-specific APIs) can be added without rewriting orchestration.
4. Operate with **conservative rate limiting**, retries, and idempotent writes; MVP scope remains **daily/batch** refresh, not real-time streaming.

### Rationale
- Aligns with “low-cost/free where viable” product strategy for a single-user app.
- Yahoo coverage is broad for common equity/ETF symbols used in personal portfolios.
- Adapter isolates upstream churn (API shape, access method) from core ledger/snapshot logic.

### Consequences
**Positive**
- Single clear target for DB-150-style implementation work.
- Manual price path remains for unsupported symbols or asset types.

**Negative / risks**
- Yahoo’s terms of service and unofficial access patterns may change; the team must monitor breakage and may need to adjust the adapter or add a fallback provider later.
- Not a substitute for a licensed real-time or regulatory-grade market data feed.

## Appendix A — Data Model Update Summary for Username/Password (ADR-011 + ADR-007)

### Replace email OTP auth model with username/password
#### `user_account` (updated)
Recommended fields:
- `id` (UUID, PK)
- `username` (varchar, unique, not null)
- `password_hash` (varchar, not null)
- `is_active` (boolean, default true)
- `created_at` (timestamptz, not null)
- `updated_at` (timestamptz, not null)
- `last_login_at` (timestamptz, nullable)

#### Remove / deprecate
- `auth_otp_challenge`
- `user_totp_secret` table

#### Add
- `user_session`

### Note on logging
No full audit table is required for MVP by current decision. Keep lightweight mutation/event logs for debugging and operational traceability.

---

## Appendix B — Deferred Items
- Secondary or failover market data providers (beyond Yahoo Finance per ADR-014)
- FX provider integration (manual-first accepted)
- Broker sync architecture
- Auto-trading execution architecture
- Staging environment topology
- Additional LLM providers beyond the supported MVP set
