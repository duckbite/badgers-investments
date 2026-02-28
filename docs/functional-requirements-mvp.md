# Badgers Investments — Functional Requirements (MVP)

## 1. Purpose and Scope

This document defines the functional requirements for the **Badgers Investments MVP**, a single-user web application for investment monitoring and recommendation.

**MVP scope: stocks only.** The MVP supports stocks and ETFs only; all other asset classes (cash/savings, bonds, crypto, real estate, commodities, custom) are out of scope and deferred to post-MVP.

The MVP covers:
- wealth tracking for stocks (and ETFs),
- ledger-based position derivation,
- performance reporting (TWR),
- and recommendation generation (rules + AI).

---

## 2. Actors

## 2.1 Primary Actor
- **Authenticated User** (single user / owner)

## 2.2 External Systems (Supporting Actors)
- **Market Data Provider** (prices, optionally FX)
- **AI Provider** (OpenAI via user-supplied API key)
- **Time/Job Scheduler** (optional for background refreshes, if implemented in MVP)

---

## 3. Functional Modules

1. Authentication and Session Management
2. Asset Management
3. Transaction Ledger Management
4. Valuation and Price Data
5. Portfolio Dashboard and Views
6. Holdings and Lot Drill-Down
7. Performance Reporting (TWR)
8. Portfolio Configuration (Risk/Targets)
9. Recommendation Engine (Rules + AI)
10. Recommendation History
11. Audit Logging
12. Settings and Provider Configuration

---

## 4. Functional Requirements

## 4.1 Authentication and Session Management

### FR-AUTH-001 — Username/Password Login
The system shall allow the user to log in using:
- a username
- a password

**Acceptance**
- Login succeeds only when valid credentials are provided.
- Invalid username/password combinations shall be rejected with a generic authentication error.

### FR-AUTH-002 — Password Storage
The system shall store the user's password as a one-way hash in the database and shall never store or log plaintext passwords.

**Acceptance**
- The database stores only a password hash (and associated parameters/salt as required by the hash scheme), never plaintext.
- Password verification is performed by comparing the provided password to the stored hash.
- Logs and error responses never include password values.

### FR-AUTH-003 — Session Handling
The system shall create an authenticated session after successful login and require authentication for protected routes.

**Acceptance**
- Protected pages shall redirect to login when unauthenticated.
- Logout shall invalidate the active session.

### FR-AUTH-004 — Login Error Handling
The system shall return generic authentication failure messages without revealing which factor failed.

---

## 4.2 Asset Management

### FR-ASSET-001 — Create Asset
The system shall allow the user to create assets for supported asset types. **MVP: stocks only.**
- STOCK
- ETF
- *Out of scope for MVP:* CASH/SAVINGS, CRYPTO, REAL_ESTATE, bonds, commodities, CUSTOM

Required fields (minimum):
- name
- asset type
- currency
- ownership percentage

Optional fields:
- symbol/ticker
- ISIN
- exchange
- sector
- notes

### FR-ASSET-002 — Edit Asset Metadata
The system shall allow editing of asset metadata (e.g., notes, ownership %, identifiers), excluding derived holding totals.

### FR-ASSET-003 — Archive Asset
The system shall allow deactivating/archiving an asset without deleting historical transactions.

### FR-ASSET-004 — Asset Listing
The system shall provide a list of assets with filters by:
- asset type
- active/archived status

---

## 4.3 Transaction Ledger Management

### FR-TXN-001 — Ledger as Source of Truth
The system shall derive positions/holdings from ledger transactions and shall not allow direct editing of position totals.

### FR-TXN-002 — Add Transaction
The system shall allow the user to add transactions for supported types:
- BUY
- SELL
- DEPOSIT
- WITHDRAWAL
- FEE
- ADJUSTMENT
- (recommended) DIVIDEND
- (recommended) INTEREST

### FR-TXN-003 — Edit Transaction
The system shall allow editing a transaction and shall record the change in the audit log.

### FR-TXN-004 — Delete Transaction
The system shall support transaction deletion via soft delete or auditable delete mechanism.

### FR-TXN-005 — Transaction Validation
The system shall validate transaction inputs based on transaction type rules, including (at minimum):
- positive quantities for BUY/SELL
- positive amounts for DEPOSIT/WITHDRAWAL/FEE
- notes required for ADJUSTMENT
- no negative holdings after SELL (MVP, no shorting)

### FR-TXN-006 — Transaction Listing and Filtering
The system shall display a transaction list with filters for:
- asset
- date range
- transaction type

### FR-TXN-007 — Transaction Chronology
The system shall process transactions in deterministic chronological order using:
1. trade timestamp (if present)
2. trade date
3. tie-breaker (created time / id)

---

## 4.4 Valuation and Price Data

### FR-VAL-001 — Price Snapshot Storage
The system shall store market price snapshots with:
- asset reference
- price
- currency
- timestamp
- provider/source metadata (where available)

### FR-VAL-002 — Manual Valuation for Non-Market Assets
The system shall allow manual valuation entries for real estate and other non-market/manual assets.

### FR-VAL-003 — Latest Valuation Usage
The system shall use the latest valid price snapshot or manual valuation to compute current asset value.

### FR-VAL-004 — Price Refresh
The system shall allow the user to trigger a manual market price refresh for supported assets.

### FR-VAL-005 — Price Refresh Error Handling
If one or more price lookups fail, the system shall:
- continue processing other assets where possible
- surface partial failure status to the user
- retain last known values

### FR-VAL-006 — Data Freshness Indicators
The system shall expose valuation/price timestamps so the UI can show data freshness.

### FR-VAL-007 — FX Conversion (If Enabled)
If assets are held in non-base currencies, the system shall convert values to portfolio base currency using stored FX rates or a documented fallback approach.

---

## 4.5 Portfolio Dashboard and Wealth Overview

### FR-DASH-001 — Consolidated Portfolio Value
The system shall display total portfolio value in the base currency.

### FR-DASH-002 — Allocation Breakdown
The system shall display allocation by asset class and/or asset.

### FR-DASH-003 — P/L Summary
The system shall display:
- total unrealised P/L
- total realised P/L (at least cumulative, optionally by period)

### FR-DASH-004 — Filters
The dashboard shall support filtering by:
- asset type
- date range (for applicable charts/views)

### FR-DASH-005 — Ownership Percentage Application
The system shall apply ownership percentage when reporting exposure and aggregated portfolio values.

### FR-DASH-006 — Data Freshness Visibility
The dashboard shall display or make available indicators for price/recommendation freshness.

---

## 4.6 Holdings and Lot-Level Drill-Down

### FR-HOLD-001 — Holdings View
The system shall provide a holdings view listing (where applicable):
- asset
- quantity
- cost basis / average cost
- current price
- current value
- unrealised P/L
- allocation %

### FR-HOLD-002 — Asset Detail View
The system shall provide an asset detail view showing:
- transaction history
- valuation history (manual and/or price)
- realised/unrealised P/L context

### FR-HOLD-003 — Lot-Level Drill-Down
For assets with multiple BUY transactions, the system shall support drill-down into separate lots (or equivalent cost-basis slices) and their P/L.

### FR-HOLD-004 — Realised P/L from Sells
The system shall compute realised P/L for SELL transactions using the configured cost basis method (recommended: FIFO) consistently across UI and reports.

---

## 4.7 Performance Reporting (TWR)

### FR-PERF-001 — TWR Calculation
The system shall calculate portfolio Time-Weighted Return (TWR) using the documented MVP method (recommended: daily sub-period TWR).

### FR-PERF-002 — External Cash Flow Handling
The TWR calculation shall treat DEPOSIT and WITHDRAWAL as external cash flows, distinct from internal reallocations (BUY/SELL).

### FR-PERF-003 — TWR Time Ranges
The system shall provide TWR for at least one selectable time range and preferably multiple ranges (e.g., 1M, 3M, YTD, 1Y, All).

### FR-PERF-004 — Performance Visualisation
The system shall provide a historical portfolio value and/or performance trend chart.

### FR-PERF-005 — Method Transparency
The system shall retain or expose the TWR calculation method/version used for reported values (for reproducibility/debugging).

---

## 4.8 Portfolio Configuration (Risk / Targets / Limits)

### FR-CONF-001 — Store Active Portfolio Configuration
The system shall store an active portfolio configuration used by the recommendation engine, including:
- risk profile/risk score
- target allocations by asset class
- min/max allocation ranges
- concentration limits
- base currency

### FR-CONF-002 — Versioned Configuration (Recommended)
The system should version portfolio configuration changes so recommendation runs can reference the exact config used.

### FR-CONF-003 — Edit Configuration
The system shall allow the user to update risk/target settings.

### FR-CONF-004 — Config Validation
The system shall validate configuration values (e.g., percentages, ranges, limits) before saving.

---

## 4.9 Recommendation Engine (Rules + AI)

### FR-REC-001 — Manual Recommendation Run
The system shall allow the user to manually trigger a recommendation run.

### FR-REC-002 — Deterministic Analytics Preprocessing
Before generating recommendations, the system shall compute a deterministic analytics payload including portfolio values, allocations, concentration metrics, P/L, and data freshness metrics.

### FR-REC-003 — Rule Evaluation
The system shall evaluate deterministic rules (e.g., concentration, allocation drift, cash buffer, data freshness) and persist triggered findings.

### FR-REC-004 — Explicit Recommendation Outputs
The system shall produce explicit recommendation types:
- BUY
- SELL
- HOLD
- optional WATCH

at portfolio level and/or asset level.

### FR-REC-005 — Recommendation Rationale
Each recommendation item shall include a human-readable rationale.

### FR-REC-006 — AI Provider Integration
The system shall support AI-assisted synthesis using OpenAI via user-supplied API key and a provider abstraction layer.

### FR-REC-007 — AI Output Validation
The system shall validate AI outputs (e.g., JSON schema/enums) before storing/displaying them.

### FR-REC-008 — Fallback on AI Failure
If AI generation fails or returns invalid output, the system shall generate and present deterministic rule-based recommendation output (degraded mode).

### FR-REC-009 — Recommendation Metadata
The system shall persist recommendation run metadata, including:
- run status
- timestamps
- config version used
- AI model/provider metadata (if AI used)
- data freshness / valuation timestamp
- analytics hash (recommended)

### FR-REC-010 — Confidence and/or Strength Scores (Recommended)
The system should assign confidence and/or strength scores to recommendations based on rule severity and data quality.

---

## 4.10 Recommendation History and Review

### FR-RECHIST-001 — Recommendation Run History
The system shall store recommendation runs and allow the user to view past runs.

### FR-RECHIST-002 — Latest Recommendation Summary
The system shall display the most recent recommendation summary in the dashboard or recommendations page.

### FR-RECHIST-003 — Run Detail Inspection
The system shall allow the user to inspect a recommendation run’s findings and recommendation items.

---

## 4.11 Audit Logging and Activity Tracking

### FR-AUD-001 — Audit Key Actions
The system shall log key actions, including:
- login attempts (success/failure, at least basic)
- asset create/update/archive
- transaction create/update/delete
- configuration changes
- price refresh runs
- recommendation runs

### FR-AUD-002 — Audit Metadata
Audit records shall include at least:
- event type
- timestamp
- entity reference (where applicable)
- actor (user)
- basic metadata (sanitised)

### FR-AUD-003 — Audit Accessibility
The system shall provide a basic UI or admin page to inspect recent audit/activity records.

---

## 4.12 Settings and Provider Configuration

### FR-SET-001 — OpenAI API Key Storage
The system shall allow the user to store an OpenAI API key securely for recommendation generation.

### FR-SET-002 — AI Model Selection
The system shall allow selecting a supported AI model (from configured/allowed options).

### FR-SET-003 — Provider Settings
The system shall support configuration of market data provider settings as needed.

### FR-SET-004 — Secret Handling
The system shall not display stored secrets in plaintext after save and shall not write secrets to logs.

---

## 5. Cross-Functional Behaviour Requirements

## 5.1 Error Handling
### FR-X-001
The system shall provide user-readable error messages for validation, provider, and recommendation failures.

### FR-X-002
The system shall avoid exposing sensitive implementation details or secrets in errors.

## 5.2 Responsiveness
### FR-X-003
The UI shall be responsive and usable on desktop and mobile form factors.

## 5.3 Determinism / Reproducibility
### FR-X-004
Portfolio calculations and rule findings shall be reproducible from:
- ledger transactions
- price/valuation snapshots
- active config version
- documented calculation method/version

---

## 6. In-Scope vs Out-of-Scope (MVP)

## 6.1 In Scope
- Single-user auth with username + password (stored hashed) and Postgres-backed sessions
- Asset and ledger management (stocks and ETFs only in MVP)
- Wealth dashboard
- Holdings drill-down
- TWR
- Rules + AI recommendation generation
- Audit logs
- Settings/API key management
- Local + cloud deployment readiness

## 6.2 Out of Scope
- Auto-trading / broker execution
- Email OTP / passwordless login
- SMS OTP
- Multi-user administration
- Tax reporting
- XIRR
- Advanced news/sentiment scraping
- Sophisticated optimisation engines
- Other asset classes in MVP (cash/savings, bonds, crypto, real estate, commodities, custom — post-MVP)

---

## 7. Acceptance Summary (MVP Functional Readiness)

The MVP is functionally ready when the user can:
1. log in securely,
2. manage assets and transactions,
3. view consolidated wealth and performance (including TWR),
4. inspect holdings/lots,
5. configure risk targets,
6. run recommendations and receive explicit buy/sell/hold outputs with rationale,
7. review recommendation history and audit records,
8. continue using core functionality when AI/provider calls fail.
