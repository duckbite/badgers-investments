# Badgers Investments — MVP Product Requirements Document (PRD)

## Document Control
- **Product:** Badgers Investments
- **Version:** MVP PRD v1.1 (Draft)
- **Scope:** Single-user personal wealth tracking and recommendation web app
- **Target platform:** Responsive Svelte SPA frontend + Fastify/Node.js backend (REST JSON API)
- **Deployment:** Local development, cloud production

## Product Summary
Badgers Investments is a single-user investment monitoring and recommendation tool for personal use. The MVP provides:
- consolidated wealth view for stocks (and ETFs) only
- transaction-ledger-based portfolio tracking
- performance reporting (including TWR)
- portfolio diagnostics and rule-based signals
- AI-assisted analysis with explicit **buy/sell/hold** recommendations

The MVP prioritises correctness, traceability, and practical usability over broad integrations or automation.

## Goals (MVP)
1. Consolidate wealth data for stocks (and ETFs) only.
2. Track holdings from a transaction ledger (no editable position totals).
3. Provide portfolio performance insights, including TWR.
4. Support lot-level drill-down for symbols with multiple transactions.
5. Generate actionable recommendations (buy/sell/hold) using rules + AI explanation.
6. Run securely as a single-user app with passwordless email OTP login and Postgres-backed server sessions.
7. Deploy locally and in the cloud with a simple, cost-effective architecture.

## Non-Goals (MVP)
- Automated trading / broker write access
- Broker/exchange sync
- SMS OTP authentication
- Advanced sentiment scraping
- Multi-user support
- Tax reporting
- XIRR (later)
- Complex optimisation models
- Other asset classes in MVP (cash/savings, bonds, crypto, real estate, commodities, custom — post-MVP)

## Target User
- Single technical user (you)
- Comfortable with configuration/manual entry
- Wants explicit buy/sell/hold calls and rationale

## MVP Scope: Stocks Only
For the MVP, the product supports **stocks and ETFs only**. All other asset classes (cash/savings, bonds, crypto, real estate, commodities, custom) are explicitly out of scope and deferred to post-MVP. Transaction types remain BUY, SELL, DIVIDEND, INTEREST, FEE, ADJUSTMENT; DEPOSIT/WITHDRAWAL may be omitted or minimal if cash is not modelled as an asset in MVP.

## Product Principles
1. **Ledger-first**
2. **Explainable recommendations**
3. **Deterministic core**
4. **Single-user simplicity**
5. **Future-ready boundaries**

## Functional Scope (MVP)

### 1) Authentication and Access
- Email-based OTP login (passwordless)
- OTP challenge creation, delivery via AWS SES, verification, and expiry
- Session management and logout using Postgres-backed server sessions

**Acceptance**
- Login succeeds only when a valid, non-expired OTP challenge for the supplied email is verified.
- Invalid email/OTP combinations are rejected with a generic authentication error.
- Protected routes require an active, valid session.

### 2) Asset and Transaction Ledger Management
**Supported asset types (MVP: stocks only)**
- Stock
- ETF  
- *Out of scope for MVP:* Cash/Savings, bonds, crypto, real estate, commodities, custom

**Asset attributes**
- Name, type, symbol/ticker (optional), currency, ownership %, notes

**Transaction types**
- Buy, Sell, Deposit, Withdrawal, Fee, Adjustment
- Valuation update (or separate manual valuation record)

**Features**
- Create/edit/archive asset
- Add/edit/delete transaction (audited)
- Filterable transaction list
- Derived holdings from ledger

**Acceptance**
- Holdings are recalculated from transactions and not manually editable
- Ownership % affects exposure calculations
- Transaction filters work

### 3) Wealth Overview Dashboard
**Components**
- Total portfolio value (base currency)
- Value by holding / sector (stocks and ETFs in MVP)
- Allocation chart
- Top holdings
- Unrealised / realised P&L
- Latest recommendation summary
- Data freshness indicators

**Filters**
- Asset type
- Date range
- Active vs archived (optional)

### 4) Holdings and Lot-Level Drill-Down
- Holdings table with quantity, cost basis, current value, unrealised P&L, allocation
- Asset detail page with transactions, lot breakdown, realised P&L history
- Price chart for market assets (if data available)

### 5) Performance Reporting (TWR)
- Portfolio TWR for selectable ranges (e.g., 1M, 3M, YTD, 1Y, All)
- Historical portfolio value chart
- Unrealised/realised P&L
- XIRR out of scope

### 6) Portfolio Configuration (Risk & Preferences)
- Risk appetite / risk score
- Target allocation ranges by asset class
- Concentration limits
- Optional exclusions/preferences
- Base currency

Implementation may be hard-coded initially or DB-backed UI (preferred if modest effort).

### 7) Recommendation Engine (Rules + AI)
- Manual run trigger
- Deterministic checks + AI explanation
- Explicit **BUY / SELL / HOLD** outputs (optional WATCH)
- Rationale, assumptions, timestamps, freshness
- Store recommendation run and history

**Guardrails**
- AI consumes structured analytics, not unbounded prompts
- Recommendation runs are logged
- Fallback to deterministic output if AI fails

### 8) Market Data and Price Refresh
- Price provider abstraction
- Manual refresh prices action
- Price snapshots with timestamps/source
- Historical price snapshots for charting
- Graceful partial failure handling

### 9) Charts and Visualisations
- Portfolio allocation by asset class
- Portfolio value over time
- P&L trend
- Asset price chart (market assets)

### 10) Audit Logging and Activity History
Log:
- Login success/failure
- TOTP setup/reset
- Asset changes
- Transaction changes
- Price refresh runs
- Recommendation runs
- Settings changes

### 11) Settings and API Keys
- OpenAI API key (secure storage)
- AI model selection
- Base currency
- Auth/TOTP settings
- Provider settings (if needed)

## User Flows

### First-Time Setup
1. Open app
2. Log in / initial credentials
3. Enrol TOTP
4. Configure base currency, risk config, OpenAI key
5. Add assets and transactions
6. Refresh prices
7. View dashboard
8. Run first recommendation

### Ongoing Weekly Review
1. Log in
2. Add transactions
3. Refresh prices
4. Review dashboard/holdings
5. Run recommendation engine
6. Review buy/sell/hold rationale
7. Record follow-up transactions if acted upon

## UI / Screen Requirements
- Login
- TOTP Setup/Verify
- Dashboard
- Assets List
- Asset Detail
- Transactions List
- Add/Edit Transaction
- Recommendations (latest + history)
- Settings
- Audit Log / Activity

**UX**
- Responsive web UI
- Data freshness indicators
- AI availability/run state indicators
- Consistent currency formatting
- Destructive action warnings
- Clear empty states

## Data and Calculation Requirements
- **Source of truth:** transaction ledger
- Holdings/positions derived from ledger
- Position totals not directly editable
- Ownership % respected in reporting
- Returns: **TWR in MVP**, XIRR later
- Cost basis method must be defined and documented
- Price/valuation timestamps must be traceable
- Recommendation outputs show data freshness

## Non-Functional Requirements
### Security
- HTTPS (prod)
- Username/password + TOTP
- Hashed/salted passwords
- Secure sessions/cookies
- Input validation
- Secrets not logged
- Basic login rate limiting

### Reliability
- Graceful provider outage handling
- AI failure fallback to deterministic outputs
- Deterministic reproducible calculations from ledger

### Performance
- Responsive for personal dataset
- Recommendation run completes in practical interactive timeframe

### Deployability
- Reproducible local setup
- Documented cloud deployment
- Environment-based config separation

## Technical Requirements
- **Front-end:** Svelte SPA application
- **Backend:** Fastify-based Node.js REST API (separate from the frontend)
- **Database:** PostgreSQL + migrations
- **Integrations:** OpenAI API + at least one market data provider

## Error Handling
- User-readable, actionable errors
- No secret leakage in errors
- Price refresh partial failures keep last known prices
- AI failure shows deterministic analysis and clear status
- Field-level validation for transaction input
- Generic auth failure messages

## MVP Release Acceptance Criteria
1. Secure login with passwordless email OTP and Postgres-backed sessions
2. Asset and transaction management for stocks (and ETFs) only
3. Ledger-derived holdings and valuations
4. Dashboard with consolidated wealth/allocation
5. Asset detail and lot-level inspection
6. TWR included
7. Risk/profile configuration used by recommendations
8. Recommendation runs with explicit buy/sell/hold and rationale
9. Auditability of recommendations and key actions
10. Local + cloud deployment over HTTPS

## Risks / Open Design Decisions
1. Cost basis method (FIFO vs average cost)
2. Base currency / FX handling scope
3. Real estate valuation model
4. Recommendation output JSON/UI shape
5. Market data provider choice
6. TWR granularity (daily vs event-driven)
7. Transaction edit/delete policy

## Post-MVP Backlog
- XIRR
- Technical indicators (MACD/RSI/etc.)
- Read-only broker sync
- News/sentiment ingestion
- Watchlists and alerts
- Trade ticket generation
- Auto-trading with guardrails
