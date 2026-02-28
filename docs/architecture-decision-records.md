# Badgers Investments — ADR Pack (MVP Architecture Decisions)

## ADR-000 Index

This pack contains the initial Architecture Decision Records (ADRs) for the MVP.

### Included ADRs
- ADR-001 — Frontend/Backend Split and Backend Module Boundaries
- ADR-002 — Deployment Topology on AWS ECS Fargate
- ADR-003 — Snapshot-First Data Architecture and Rebuild Invalidation Policy
- ADR-004 — Multi-Currency and FX Handling for `TWR_DAILY_V1`
- ADR-005 — Recommendation Orchestration and Deduplication
- ADR-006 — Passwordless Email OTP Authentication via AWS SES
- ADR-011 — Username/Password Authentication (Supersedes ADR-006)
- ADR-007 — Postgres-Backed Cookie Session Strategy
- ADR-008 — OpenAI-First Recommendation Integration and Validation Pipeline
- ADR-009 — API Style and Frontend Integration (REST JSON + Typed DTOs)
- ADR-010 — Charting and Observability Baseline (Chart.js + CloudWatch Logs)

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
- Better fit for separate worker and ECS deployment
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
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
Production must be AWS-hosted, HTTPS-enabled, and simple to operate.

### Decision
Use **AWS ECS Fargate** for production compute.

### MVP Topology
- Frontend container service (Svelte)
- Backend API container service (Fastify)
- Worker container/task
- RDS PostgreSQL
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
9. Invoke OpenAI
10. Validate AI output
11. Persist run + findings + items
12. Return result

### AI Policy
AI is assumed available and is the primary recommendation synthesis path.

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

## ADR-007 — Postgres-Backed Cookie Session Strategy
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
You chose cookie-based server sessions and followed the recommendation for Postgres-backed storage.

### Decision
Use **server-side sessions stored in PostgreSQL**, with an opaque session ID in a secure cookie.

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
- Works reliably in Fargate across tasks/restarts
- Enables server-side revocation/logout

---

## ADR-008 — OpenAI-First Recommendation Integration and Validation Pipeline
- **Status:** Accepted
- **Date:** 2026-02-23

### Context
You chose:
- OpenAI first
- KISS
- prompt versions in code
- no provider abstraction yet

### Decision
Implement a direct **OpenAI integration** in backend `ai` module for MVP.

### Rules
- Prompt templates/version IDs live in code
- Deterministic analytics/rules/scoring run before AI call
- AI output must be strict JSON (or parseable to expected JSON)
- Backend validates AI output before persistence/use

### Validation (minimum)
- parseable JSON
- required fields present
- enum values valid
- referenced asset IDs exist in current run context
- deterministic scores remain authoritative

### Rationale
- Fastest delivery
- Lowest abstraction overhead
- Still replaceable later because integration is confined to one module

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
The MVP authentication requirement changed from passwordless email OTP (ADR-006) to a standard username/password login, while keeping Postgres-backed cookie sessions (ADR-007).

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
- Keeps the session strategy unchanged and compatible with ECS deployments.

### Consequences
**Positive**
- Works offline/local without email provider setup.
- Simpler end-user flow for a single-user app.

**Negative**
- Requires secure password hashing and handling.
- Requires a password bootstrap/reset strategy (single-user ops decision).

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
- Market data provider selection and integration details
- FX provider integration (manual-first accepted)
- Broker sync architecture
- Auto-trading execution architecture
- Staging environment topology
- AI provider abstraction layer
