# Badgers Investments — System Architecture Document (SAD) (MVP)

## 1. Document Control

- **Product:** Badgers Investments
- **Document:** System Architecture Document (SAD)
- **Version:** MVP SAD v1.0 (Draft)
- **Status:** Draft (aligned to accepted ADRs)
- **Scope:** MVP architecture for single-user investment monitoring and recommendation system

---

## 2. Purpose

This document defines the end-to-end technical architecture for the Badgers Investments MVP, including:

- system context and boundaries,
- component architecture,
- deployment architecture,
- data flows,
- job execution model,
- API boundaries,
- security architecture,
- data storage and snapshot strategy,
- recommendation orchestration,
- operational concerns.

This SAD implements the architectural decisions captured in the ADR pack.

---

## 3. Architectural Drivers

## 3.1 Functional Drivers
- Single-user wealth tracking across cash, stocks/ETFs, crypto, and real estate
- Ledger-first portfolio calculations
- Multi-currency support (major currencies) with daily FX
- Daily TWR performance reporting
- AI-powered recommendation generation with deterministic scoring
- Manual-first data entry (including manual FX in MVP)
- Snapshot-first analytics and dashboarding

## 3.2 Non-Functional Drivers
- Simplicity (MVP / personal-use context)
- Correctness and reproducibility of calculations
- Cost-effective cloud hosting
- Secure passwordless authentication (email OTP)
- Extensibility for future providers, broker sync, and auto-trading
- Operable with lightweight logging/monitoring

---

## 4. Scope and Assumptions (MVP)

## 4.1 In Scope
- Svelte frontend + Fastify backend API
- ECS Fargate deployment
- EventBridge-triggered worker tasks
- PostgreSQL (RDS in prod)
- Prisma ORM/migrations
- Email OTP via AWS SES
- Postgres-backed server sessions
- OpenAI integration (KISS, direct module)
- REST JSON APIs with typed DTOs
- Full snapshot layer from day one

## 4.2 Out of Scope
- Broker/exchange API integrations
- Auto-trading execution
- Multi-user tenancy
- Staging environment (initial release)
- Full audit subsystem
- AI provider abstraction layer (MVP)

## 4.3 Key Assumptions
- AI model availability is assumed for recommendation runs
- Market/FX provider integrations are deferred; manual entry is primary in MVP
- User traffic is low (single-user, low concurrency)
- Data volume is modest but growing over time

---

## 5. System Context

## 5.1 Context Overview

Badgers Investments consists of:
- a **Svelte frontend** for user interaction,
- a **Fastify backend API** for domain logic and persistence,
- a **worker runtime** for scheduled/heavy jobs,
- **PostgreSQL** for canonical and derived data,
- AWS-managed services for email, secrets, scheduling, and logging,
- **OpenAI** for recommendation synthesis.

## 5.2 External Dependencies (MVP)
- **AWS SES** — email OTP delivery
- **OpenAI API** — recommendation synthesis
- **AWS EventBridge** — scheduled job triggers
- **AWS Secrets Manager + KMS** — secret management
- **CloudWatch Logs** — application logs
- **RDS PostgreSQL** — managed relational database

---

## 6. Architectural Style

## 6.1 Overall Style
- **Distributed system at deployment level**
  - frontend service
  - backend API service
  - worker service/task
- **Modular monolith at backend code level**
  - domain modules within one Fastify codebase/runtime boundary (API)
  - shared domain logic reused by worker

## 6.2 Why This Style
- Keeps the codebase simple for a single-user MVP
- Supports separate concerns (interactive API vs scheduled/heavy jobs)
- Aligns with ECS Fargate deployment and EventBridge scheduling
- Preserves future extensibility without premature microservices

---

## 7. High-Level Component Architecture

## 7.1 Components

### Frontend (Svelte)
Responsibilities:
- Render dashboard, holdings, transactions, settings, recommendations
- Manage UI state using Svelte stores
- Call backend REST APIs with typed DTOs
- Display charts via Chart.js
- Handle email OTP login UX and session lifecycle

### Backend API (Fastify)
Responsibilities:
- Expose REST JSON endpoints
- Authenticate requests via Postgres-backed sessions (cookie session ID)
- Execute domain logic and validations
- Persist canonical data and snapshots
- Orchestrate recommendation runs (interactive path)
- Trigger/coordinate rebuilds and jobs
- Integrate with SES and OpenAI

### Worker (Node.js / shared domain code)
Responsibilities:
- Execute scheduled and heavy jobs
- Process snapshot rebuilds/backfills
- Run price/FX import jobs (future)
- Reuse same domain services/use cases as API where possible

### PostgreSQL (RDS in prod)
Responsibilities:
- Store canonical domain data (ledger, assets, valuations, FX, configs)
- Store authentication challenges/sessions
- Store derived snapshots
- Store recommendation runs/findings/items
- Store lightweight mutation logs

### AWS Services
- **EventBridge:** trigger worker jobs on schedule
- **SES:** send OTP emails
- **Secrets Manager + KMS:** secrets and encryption keys
- **CloudWatch Logs:** centralised logging for API and worker

### OpenAI
Responsibilities:
- Synthesize recommendation narrative/outputs from deterministic analytics payload and rule findings

---

## 8. Backend Module Architecture (Fastify Modular Monolith)

## 8.1 Module List (MVP)

1. **auth**
   - email OTP request/verify
   - OTP challenge lifecycle
   - login rate limiting hooks
2. **sessions**
   - session creation/lookup/revocation
   - cookie issuance/validation
3. **portfolio**
   - portfolio settings and metadata
4. **assets**
   - asset CRUD (including ownership %)
5. **ledger**
   - transaction CRUD/validation
   - FIFO lot matching orchestration
6. **valuations**
   - manual valuations
   - manual FX entries
   - price records (manual/provider-ready)
7. **snapshots**
   - position/portfolio/performance snapshot generation
   - invalidation/rebuild orchestration (`earliest_affected_date`)
8. **performance**
   - `TWR_DAILY_V1` calculations
9. **recommendations**
   - end-to-end recommendation run orchestration
   - deduplication logic
10. **rules**
   - deterministic recommendation rules
   - deterministic scoring
11. **ai**
   - OpenAI client wrapper
   - prompt templates/versioning (code)
   - response validation adapter
12. **jobs**
   - worker handlers and shared job use-cases
13. **logging**
   - structured logging helpers
   - mutation logging helpers

## 8.2 Layering Rules
- Route handlers should be thin and call application services/use-cases.
- Domain calculation logic must not live in frontend or route handlers.
- Database access should be encapsulated in repositories/services (Prisma-based).
- `rules` and `performance` modules should be deterministic and testable without API/runtime dependencies.
- Worker and API should call shared use-case services, not duplicate orchestration logic.

---

## 9. Data Architecture

## 9.1 Canonical vs Derived Data

### Canonical Data (Source of Truth)
- `transaction_ledger`
- `asset`
- `asset_valuation_manual`
- `price_snapshot` (manual/provider-entered)
- `fx_rate_snapshot`
- `portfolio_config_version`
- auth/session tables

### Derived Data (Snapshot-First)
- `position_snapshot`
- `portfolio_snapshot`
- `performance_snapshot`
- recommendation analytics summaries/hashes (persisted per run)

### Principle
Canonical data is authoritative. Derived data can be invalidated and rebuilt.

---

## 9.2 Database Technology
- **Local development:** Dockerised PostgreSQL
- **Production:** AWS RDS PostgreSQL (or Postgres-compatible managed DB)
- **ORM / migrations:** Prisma

## 9.3 Precision and Numeric Handling (Critical)
- Use Postgres `numeric/decimal` for monetary values, quantities, rates, and returns.
- Avoid JavaScript floating-point (`number`) for financial calculations.
- Use Prisma decimal types end-to-end in domain services.
- Apply rounding only at display/output boundaries, not during core calculations unless explicitly required.

---

## 10. Authentication and Session Architecture

## 10.1 Authentication Model
- **Passwordless email OTP only**
- OTPs delivered via **AWS SES**
- Session-based authentication after OTP verification

## 10.2 OTP Challenge Flow
1. Frontend submits email to `POST /auth/otp/request`
2. Backend validates rate limits and user eligibility
3. Backend generates OTP code and stores **hashed OTP** in `auth_otp_challenge`
4. Backend sends OTP email via SES
5. Frontend submits OTP to `POST /auth/otp/verify`
6. Backend verifies challenge:
   - not expired
   - not consumed
   - attempt limit not exceeded
   - hash match
7. Backend creates `user_session`
8. Backend sets secure session cookie
9. Frontend proceeds as authenticated user

## 10.3 Session Model
- Cookie stores opaque session ID
- Session record stored in Postgres (`user_session`)
- Session validation on protected endpoints
- Logout revokes session server-side

## 10.4 Security Controls (MVP)
- OTP stored hashed, never plaintext
- OTP expiry (short TTL)
- Single-use OTP challenges
- Attempt limits
- Endpoint rate limiting (request + verify)
- Secure cookie flags (`HttpOnly`, `Secure` in prod, `SameSite` as required)
- Minimal mutation logging for auth events (no full audit system)

---

## 11. API Architecture

## 11.1 API Style
- **REST JSON**
- Typed request/response DTOs
- Consistent error envelope
- Cookie-authenticated endpoints for protected operations

## 11.2 Endpoint Categories (MVP)
- **Auth**
- **Assets**
- **Ledger / Transactions**
- **Valuations / Prices / FX**
- **Snapshots / Rebuild**
- **Performance**
- **Portfolio Config**
- **Recommendations**
- **Settings**
- **Mutation Logs** (optional UI/admin view)

## 11.3 Example Endpoint Surface (Indicative)
### Auth
- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/logout`
- `GET /auth/session`

### Assets / Ledger
- `GET /assets`
- `POST /assets`
- `PATCH /assets/:id`
- `GET /transactions`
- `POST /transactions`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`

### Valuations / FX
- `POST /valuations/manual`
- `POST /fx/daily`
- `GET /fx/daily`
- `POST /prices/manual` (if manual market price entry is enabled)

### Snapshots / Performance
- `POST /snapshots/rebuild`
- `GET /snapshots/status`
- `GET /performance/twr`

### Recommendations
- `POST /recommendations/runs`
- `GET /recommendations/runs`
- `GET /recommendations/runs/:id`

## 11.4 Error Contract (Recommended)
All API errors should return a consistent envelope, e.g.:
- `code`
- `message`
- `details` (optional, sanitised)
- `requestId`

---

## 12. Frontend Architecture (Svelte)

## 12.1 Frontend Responsibilities
- Present responsive UI
- Manage UI state with Svelte stores
- Call backend REST APIs via typed client
- Render Chart.js charts
- Handle optimistic/non-optimistic UI updates as appropriate
- Present data freshness and missing FX warnings clearly

## 12.2 State Management
- **Svelte stores only** (explicit decision)
- Stores organised by domain slice (e.g., auth, assets, portfolio, recommendations)
- API client layer separate from UI components
- Derived client-side computations limited to UI transformations/formatting (not financial truth)

## 12.3 Charting
- **Chart.js** for:
  - allocation charts
  - portfolio value / performance trend
  - P/L trend
  - asset price history

---

## 13. Snapshot Architecture and Rebuild Strategy

## 13.1 Snapshot Types (MVP)
- `position_snapshot` — per asset, per date/time
- `portfolio_snapshot` — aggregate portfolio metrics, per date/time
- `performance_snapshot` — TWR and related performance metrics, per period/date

## 13.2 Snapshot Generation Triggers
- Manual rebuild request via API
- Transaction create/update/delete
- Manual valuation create/update
- Daily FX entry create/update
- Price entry create/update
- Scheduled rebuild jobs (optional/introduced via worker)

## 13.3 Invalidation Strategy (`earliest_affected_date`)
On canonical-data mutation:
1. Determine earliest affected date
2. Mark snapshots from that date onward as stale (or delete them for rebuild)
3. Rebuild forward
4. Update snapshot status / job status
5. Optionally mark recommendation runs after affected date as stale-input

## 13.4 Execution Model
- Small rebuilds may execute synchronously
- Larger/historical rebuilds run via worker
- API and worker share the same rebuild use-case logic

---

## 14. Financial Calculation Architecture

## 14.1 Cost Basis and Lot Matching
- **FIFO** cost basis for MVP
- `transaction_lot_link` persisted to support realised P/L and lot drill-down
- Lot matching recalculated when relevant historical transactions change

## 14.2 Multi-Currency Conversion
- Daily FX snapshots entered manually in MVP
- Allowed currencies:
  - USD, EUR, JPY, GBP, CNY, CHF, AUD, CAD, HKD, NZD
- Asset values converted to portfolio base currency during snapshot generation
- Missing FX rates cause incomplete snapshots and flagged/degraded recommendation quality

## 14.3 Performance Calculation
- **`TWR_DAILY_V1`** accepted method
- Daily sub-period chaining
- DEPOSIT/WITHDRAWAL treated as external cash flows
- Performance snapshots persist method/version metadata for reproducibility

---

## 15. Recommendation Engine Architecture

## 15.1 Design Principles
- Deterministic analytics and scoring are authoritative
- AI synthesises and explains, but does not control score truth
- Runs are persisted and deduplicated based on stable inputs

## 15.2 Recommendation Orchestration Flow (Accepted)
1. Validate preconditions
2. Build valuation context (prices/manual valuations/FX)
3. Ensure snapshots exist / rebuild if necessary
4. Build deterministic analytics payload
5. Evaluate hard-coded rules
6. Compute deterministic scores + baseline actions
7. Compute `analytics_input_hash`
8. Deduplicate same-input runs
9. Invoke OpenAI
10. Validate AI output
11. Persist run + findings + items
12. Return result

## 15.3 Deduplication Strategy
Deduplicate by:
- `portfolio_id`
- `config_version_id`
- `analytics_input_hash`
- engine version identifiers (rules/prompt versions)

If an equivalent run exists:
- return existing result, or
- return in-progress status/reference

## 15.4 OpenAI Integration (MVP)
- Direct OpenAI client integration in `ai` module
- Prompt templates/version IDs in code
- Strict response validation before persistence
- AI assumed available for normal recommendation operation

---

## 16. Job and Worker Architecture

## 16.1 Job Types (MVP / Near-MVP)
- Snapshot rebuilds (full/partial)
- Historical backfills (manual)
- Scheduled maintenance/cleanup (sessions, stale challenges)
- Future provider sync jobs (deferred)
- Future scheduled recommendations (deferred/optional)

## 16.2 Trigger Sources
- **EventBridge** (scheduled)
- **API direct trigger** (manual UI actions)
- Potential internal domain events (future)

## 16.3 Worker Design
- Stateless worker process/task
- Uses same database and shared domain services as API
- Logs job start/end/status/failures to CloudWatch and `job_run_log` (if implemented)

## 16.4 Hybrid Execution Policy (Accepted)
- **Recommendation runs:** synchronous via API (interactive)
- **Heavy rebuilds/backfills:** worker
- **Scheduled tasks:** EventBridge → worker

---

## 17. Deployment Architecture (AWS)

## 17.1 Production Deployment Components
- **Frontend Service (ECS Fargate)**
  - Serves Svelte app
- **Backend API Service (ECS Fargate)**
  - Fastify REST API
- **Worker Task/Service (ECS Fargate)**
  - Job execution runtime
- **RDS PostgreSQL**
- **SES**
- **EventBridge**
- **Secrets Manager + KMS**
- **CloudWatch Logs**

## 17.2 Networking (Conceptual)
- Public access terminates at HTTPS load balancer
- Frontend and backend accessible over HTTPS
- Backend and worker access RDS in private networking
- SES/OpenAI called outbound from API/worker tasks

## 17.3 Environment Strategy
### MVP Release
- **Local**
- **Production**

### Later
- Add staging/pre-prod environments as needed

## 17.4 Secrets and Configuration
### Local
- A single root `.env` file (developer-managed) at the repository root.
- `/.env.example` is committed as the template; `/.env` must never be committed.
- Do not create per-service `.env` files in subdirectories (all apps/services/workers read env from the root).

### Production
- AWS Secrets Manager (encrypted with KMS)
- Environment variables injected into ECS tasks (secret refs)
- No secrets stored in frontend bundle
- No plaintext secret logging

---

## 18. Logging and Operational Observability

## 18.1 Logging Baseline (MVP)
- Structured logs to stdout/stderr
- CloudWatch Logs aggregation
- API request correlation IDs
- Worker job/run IDs
- Error logs with sanitised context
- Lightweight mutation logs (not full audit)

## 18.2 What Is Logged
### API
- request start/end
- route + status code
- request ID
- authenticated user ID (when present)
- major domain operation start/failure

### Worker
- job type
- job ID / run ID
- started/completed/failed
- key metrics/counts
- error details (sanitised)

### Domain mutations (lightweight)
- entity type/id
- mutation type
- timestamp
- actor
- optional note/reason

## 18.3 What Is Not Included (MVP)
- Full distributed tracing
- APM platform
- Deep metrics dashboards
- Enterprise audit logging

---

## 19. Security Architecture Summary

## 19.1 Identity and Access
- Passwordless email OTP via SES
- Postgres-backed server sessions
- Secure cookie session handling

## 19.2 Data Protection
- Secrets in Secrets Manager/KMS (prod)
- OTP codes hashed in DB
- Session IDs opaque
- HTTPS in production
- Sensitive values never logged in plaintext

## 19.3 Application Security Controls (MVP)
- Input validation for all API endpoints
- Rate limiting on OTP endpoints
- Session expiry and revocation
- Auth checks on protected routes/endpoints
- Basic CORS and cookie policy hardening for split frontend/backend deployment

---

## 20. Data Model Implications (Auth Update + Core Architecture)

This SAD adopts the email-OTP authentication model and supersedes earlier password/TOTP assumptions.

## 20.1 Auth Tables (MVP)
- `user_account` (email-based identity)
- `auth_otp_challenge`
- `user_session`

## 20.2 Removed from Earlier Drafts
- `password_hash` on `user_account`
- `user_totp_secret`

## 20.3 Core Domain and Snapshot Tables (MVP)
- Canonical:
  - `portfolio`, `asset`, `transaction_ledger`, `transaction_lot_link`
  - `asset_valuation_manual`, `price_snapshot`, `fx_rate_snapshot`
  - `portfolio_config_version`
- Derived:
  - `position_snapshot`, `portfolio_snapshot`, `performance_snapshot`
- Recommendation:
  - `recommendation_run`, `recommendation_item`, `rule_finding`

---

## 21. Failure Modes and Degradation Behaviour (MVP)

## 21.1 SES Failure (OTP Delivery)
- OTP request endpoint returns failure status and retry guidance
- No session creation without successful OTP verification
- Log provider error details (sanitised)

## 21.2 OpenAI Failure / Invalid Output
- Recommendation run returns explicit failure/partial status
- Run metadata should still be persisted where practical for debugging
- Deterministic analytics and scores remain available internally (implementation may choose whether to surface partial output)

## 21.3 Missing FX Data
- Snapshot generation marks incomplete status for affected dates/assets
- Recommendation run warns/degrades confidence or blocks based on policy
- UI displays freshness/completeness warnings

## 21.4 Snapshot Rebuild Failure
- Mark rebuild job/run as failed with error details
- Existing last-known snapshots remain available until rebuilt
- UI can surface rebuild status and stale state

## 21.5 Database Unavailability
- API returns service error
- Worker jobs fail and log error
- No local fallback datastore in MVP

---

## 22. Testing Strategy (Architecture-Level)

## 22.1 Test Priorities
1. Deterministic financial calculations (FIFO, TWR, FX conversion)
2. Snapshot invalidation/rebuild correctness
3. Recommendation deduplication/hash stability
4. Email OTP challenge lifecycle and session creation
5. API contract validation (REST DTOs)
6. Worker/API shared use-case consistency

## 22.2 Test Layers
- **Unit tests**
  - rules, scoring, TWR, FIFO matching, hash canonicalisation
- **Integration tests**
  - API + DB (Prisma + Postgres)
  - recommendation orchestration path with mocked OpenAI
  - auth OTP + session flow with mocked SES
- **Regression fixtures**
  - known portfolios and expected P/L/TWR outputs
- **Worker job tests**
  - rebuild from `earliest_affected_date`

---

## 23. Open Items and Future Evolution

## 23.1 Deferred Decisions / Future ADRs
- Market data provider selection and adapter design details
- FX provider integration (manual-first in MVP)
- Broker sync import architecture
- Auto-trading execution subsystem and guardrails
- Staging environment topology
- AI provider abstraction layer

## 23.2 Expected Evolution Paths
- Add provider adapters while preserving manual entry paths
- Introduce staging environment and CI/CD deployment promotion
- Separate worker image/runtime if use cases diverge significantly
- Add richer observability and metrics if operational complexity grows

---

## 24. Traceability to ADRs

This SAD implements the following accepted ADRs:
- **ADR-001** Frontend/Backend split and module boundaries
- **ADR-002** ECS Fargate deployment topology
- **ADR-003** Snapshot-first data architecture + invalidation
- **ADR-004** Multi-currency + daily FX handling for `TWR_DAILY_V1`
- **ADR-005** Recommendation orchestration + deduplication
- **ADR-006** Passwordless email OTP via SES
- **ADR-007** Postgres-backed cookie sessions
- **ADR-008** OpenAI-first integration
- **ADR-009** REST JSON + typed DTOs
- **ADR-010** Chart.js + CloudWatch logging

---

## 25. Next Recommended Technical Documents

1. **API Specification (OpenAPI)**
2. **Data Model v2 (updated for email OTP + snapshots)**
3. **Snapshot Rebuild Algorithm Spec**
4. **Recommendation Engine Technical Spec (payload schemas + validation)**
5. **AWS Infrastructure Spec (networking, ECS services, IAM, secrets, SES setup)**
