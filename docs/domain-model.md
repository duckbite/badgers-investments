# Badgers Investments — Domain Model / Schema Draft (MVP)

## Scope and Design Intent
This schema draft is for the MVP and is designed around:
- single user
- transaction ledger as source of truth
- derived holdings (not manually edited)
- TWR in MVP
- buy/sell/hold recommendations with rationale
- local dev + cloud production
- future extensibility for broker sync and auto-trading

Design priorities:
- correctness
- auditability
- deterministic recomputation
- separation of raw facts (ledger/prices/config) from derived outputs (positions/performance/recommendations)

## Domain Model Overview

### Core Domain Objects

**Identity and Security**
- `user_account`
- `user_session`

**Portfolio and Assets**
- `portfolio`
- `asset`
- `asset_valuation_manual`

**Ledger and Accounting**
- `transaction_ledger`
- `transaction_lot_link` (recommended for FIFO)

**Market Data**
- `market_data_provider`
- `price_snapshot`
- `fx_rate_snapshot` (optional MVP, recommended for multi-currency)

**Recommendations and AI**
- `portfolio_config_version`
- `recommendation_run`
- `recommendation_item`
- `rule_finding`

**Audit and Operations**
- `audit_log`
- `job_run_log`

**Optional Derived/Materialised**
- `position_snapshot`
- `portfolio_snapshot`
- `performance_snapshot`

## Entity Relationship Summary
- One `user_account` owns one `portfolio` (explicit relationship, even if single-user)
- One `portfolio` has many `assets`
- One `asset` has many `transaction_ledger` entries
- One `asset` may have many `price_snapshot` rows
- One `asset` may have many `asset_valuation_manual` rows
- One `portfolio` has many `portfolio_config_version` rows
- One `recommendation_run` belongs to one `portfolio` and one config version
- One `recommendation_run` has many `rule_finding` and `recommendation_item` rows

---

## Table Drafts (MVP)

### `user_account`
**Purpose:** Username-based login identity and account metadata for session authentication.

Fields:
- `id` (UUID, PK)
- `username` (varchar, unique, not null)
- `password_hash` (varchar, not null)
- `is_active` (boolean, default true)
- `created_at` (timestamptz, not null)
- `updated_at` (timestamptz, not null)
- `last_login_at` (timestamptz, nullable)

### `user_session`
**Purpose:** Server-side session records for cookie-backed authentication.

Fields:
- `id` (UUID, PK)
- `user_id` (UUID, FK → `user_account.id`, not null)
- `created_at` (timestamptz, not null)
- `last_seen_at` (timestamptz, not null)
- `expires_at` (timestamptz, not null)
- `ip_address` (inet, nullable)
- `user_agent` (text, nullable)
- `is_revoked` (boolean, default false)
- `revoked_at` (timestamptz, nullable)

### `portfolio`
**Purpose:** Logical container for assets, transactions, config, and recommendations.

Fields:
- `id` (UUID, PK)
- `user_id` (UUID, FK → `user_account.id`, not null)
- `name` (varchar, not null)
- `base_currency_code` (char(3), not null)
- `is_active` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

Constraint:
- Enforce one active portfolio per user in MVP (app-level or partial unique index)

### `asset`
**Purpose:** Master record for each tracked asset.

Fields:
- `id` (UUID, PK)
- `portfolio_id` (UUID, FK → `portfolio.id`, not null)
- `asset_type` (enum/text): `CASH`, `STOCK`, `ETF`, `CRYPTO`, `REAL_ESTATE`, `CUSTOM`
- `name` (varchar, not null)
- `symbol` (varchar, nullable)
- `isin` (varchar, nullable)
- `exchange_code` (varchar, nullable)
- `currency_code` (char(3), not null)
- `country_code` (char(2), nullable)
- `sector` (varchar, nullable)
- `is_listed_market_asset` (boolean, default false)
- `ownership_pct` (numeric(5,2), default 100.00)
- `is_active` (boolean, default true)
- `notes` (text, nullable)
- `created_at`, `updated_at`, `archived_at`

Constraints:
- `ownership_pct > 0 AND ownership_pct <= 100`

Notes:
- Ownership % is applied primarily as a reporting multiplier for exposure/valuation in MVP

### `asset_valuation_manual`
**Purpose:** Manual valuations for real estate / custom assets.

Fields:
- `id` (UUID, PK)
- `asset_id` (UUID, FK → `asset.id`, not null)
- `valuation_amount` (numeric(20,8), not null)
- `currency_code` (char(3), not null)
- `valuation_date` (date, not null)
- `valuation_timestamp` (timestamptz, nullable)
- `source_type` (enum/text): `MANUAL_ENTRY`, `ESTIMATE`, `APPRAISAL`
- `source_note` (text, nullable)
- `created_by_user_id` (UUID, FK → `user_account.id`, not null)
- `created_at` (timestamptz, not null)

### `transaction_ledger` (Canonical Source of Truth)
**Purpose:** Stores all portfolio activity. Holdings and P/L are derived from this table.

Fields:
- `id` (UUID, PK)
- `portfolio_id` (UUID, FK → `portfolio.id`, not null)
- `asset_id` (UUID, FK → `asset.id`, not null)
- `transaction_type` (enum/text):
  - `BUY`, `SELL`, `DEPOSIT`, `WITHDRAWAL`, `FEE`, `ADJUSTMENT`
  - recommended now: `DIVIDEND`, `INTEREST`
- `trade_date` (date, not null)
- `trade_timestamp` (timestamptz, nullable)
- `quantity` (numeric(28,12), nullable)
- `unit_price` (numeric(20,8), nullable)
- `gross_amount` (numeric(20,8), nullable)
- `fee_amount` (numeric(20,8), default 0)
- `tax_amount` (numeric(20,8), default 0, nullable)
- `currency_code` (char(3), not null)
- `fx_rate_to_portfolio_base` (numeric(20,10), nullable)
- `cash_impact_amount` (numeric(20,8), nullable)
- `cash_impact_direction` (enum/text, nullable)
- `external_reference` (varchar, nullable)
- `source_type` (enum/text, default `MANUAL`)
- `notes` (text, nullable)
- `is_deleted` (boolean, default false)
- `deleted_at` (timestamptz, nullable)
- `deleted_by_user_id` (UUID, FK → `user_account.id`, nullable)
- `created_by_user_id` (UUID, FK → `user_account.id`, not null)
- `created_at`, `updated_at` (timestamptz)

Validation (service-layer):
- `BUY`: quantity > 0, unit_price >= 0
- `SELL`: quantity > 0, unit_price >= 0, no negative holdings in MVP
- `DEPOSIT`/`WITHDRAWAL`: gross_amount > 0
- `FEE`: gross_amount > 0
- `ADJUSTMENT`: require notes
- `DIVIDEND`/`INTEREST`: gross_amount > 0

### `transaction_lot_link` (Recommended for FIFO)
**Purpose:** Links sell transactions to matched buy lots for realised P/L and lot drill-down.

Fields:
- `id` (UUID, PK)
- `sell_transaction_id` (UUID, FK → `transaction_ledger.id`, not null)
- `buy_transaction_id` (UUID, FK → `transaction_ledger.id`, not null)
- `matched_quantity` (numeric(28,12), not null)
- `buy_unit_price` (numeric(20,8), not null)
- `sell_unit_price` (numeric(20,8), not null)
- `realised_pnl_amount` (numeric(20,8), not null)
- `currency_code` (char(3), not null)
- `created_at` (timestamptz, not null)

### `market_data_provider`
**Purpose:** Registry of market/FX data providers.

Fields:
- `id` (UUID, PK)
- `provider_key` (varchar, unique, not null)
- `provider_type` (enum/text)
- `is_enabled` (boolean, default true)
- `config_json_encrypted` (text, nullable)
- `created_at`, `updated_at` (timestamptz)

### `price_snapshot`
**Purpose:** Historical price storage for market assets.

Fields:
- `id` (UUID, PK)
- `asset_id` (UUID, FK → `asset.id`, not null)
- `provider_id` (UUID, FK → `market_data_provider.id`, nullable)
- `price` (numeric(20,8), not null)
- `currency_code` (char(3), not null)
- `price_timestamp` (timestamptz, not null)
- `price_date` (date, not null)
- `data_quality` (enum/text, nullable)
- `raw_payload_hash` (varchar, nullable)
- `created_at` (timestamptz)

Constraint:
- unique candidate on (`asset_id`, `provider_id`, `price_timestamp`)

### `fx_rate_snapshot` (Optional MVP)
**Purpose:** FX rates for base-currency reporting and reproducibility.

Fields:
- `id` (UUID, PK)
- `base_currency_code` (char(3), not null)
- `quote_currency_code` (char(3), not null)
- `rate` (numeric(20,10), not null)
- `rate_timestamp` (timestamptz, not null)
- `rate_date` (date, not null)
- `provider_id` (UUID, FK → `market_data_provider.id`, nullable)
- `created_at` (timestamptz)

### `portfolio_config_version`
**Purpose:** Versioned portfolio settings used by the recommendation engine.

Fields:
- `id` (UUID, PK)
- `portfolio_id` (UUID, FK → `portfolio.id`, not null)
- `version_number` (int, not null)
- `is_active` (boolean, default true)
- `risk_profile_type` (enum/text, not null)
- `risk_score` (int, nullable)
- `base_currency_code` (char(3), not null)
- `target_allocations_json` (jsonb, not null)
- `concentration_limits_json` (jsonb, not null)
- `preferences_json` (jsonb, nullable)
- `ai_prompt_overrides_json` (jsonb, nullable)
- `notes` (text, nullable)
- `created_by_user_id` (UUID, FK → `user_account.id`, not null)
- `created_at` (timestamptz)

Constraint:
- unique (`portfolio_id`, `version_number`)

### `recommendation_run`
**Purpose:** One recommendation execution (analytics + rules + AI metadata).

Fields:
- `id` (UUID, PK)
- `portfolio_id` (UUID, FK → `portfolio.id`, not null)
- `config_version_id` (UUID, FK → `portfolio_config_version.id`, not null)
- `run_trigger_type` (enum/text)
- `run_status` (enum/text)
- `started_at`, `completed_at`
- `portfolio_valuation_timestamp`
- `price_data_freshness_summary` (jsonb)
- `analytics_input_hash` (varchar)
- `analytics_summary_json` (jsonb)
- `ai_provider_key`, `ai_model_name`, `ai_request_id`, `ai_prompt_version`
- `ai_status`, `ai_error_message`
- `portfolio_level_summary` (text)
- `created_by_user_id` (UUID, FK → `user_account.id`, nullable)
- `created_at`

Recommended extra versioning fields:
- `rule_set_version`
- `analytics_schema_version`
- `calculation_method_version`

### `recommendation_item`
**Purpose:** Portfolio-level or asset-level recommendation records.

Fields:
- `id` (UUID, PK)
- `recommendation_run_id` (UUID, FK → `recommendation_run.id`, not null)
- `scope_type` (`PORTFOLIO` | `ASSET`)
- `asset_id` (UUID, FK → `asset.id`, nullable)
- `recommendation_type` (`BUY` | `SELL` | `HOLD` | `WATCH`)
- `strength_score` (numeric(5,2), nullable)
- `confidence_score` (numeric(5,2), nullable)
- `priority_rank` (int, nullable)
- `headline` (varchar, nullable)
- `rationale` (text, not null)
- `assumptions` (text, nullable)
- `suggested_action_json` (jsonb, nullable)
- `created_at`

### `rule_finding`
**Purpose:** Deterministic rule findings generated during recommendation runs.

Fields:
- `id` (UUID, PK)
- `recommendation_run_id` (UUID, FK → `recommendation_run.id`, not null)
- `rule_code` (varchar, not null)
- `severity` (`INFO` | `WARN` | `HIGH`)
- `scope_type` (`PORTFOLIO` | `ASSET`)
- `asset_id` (UUID, FK → `asset.id`, nullable)
- `finding_text` (text, not null)
- `metrics_json` (jsonb, nullable)
- `triggered` (boolean, default true)
- `created_at`

### `audit_log`
**Purpose:** Trace changes and sensitive actions.

Fields:
- `id` (UUID, PK)
- `event_type` (varchar, not null)
- `entity_type` (varchar, nullable)
- `entity_id` (UUID, nullable)
- `actor_user_id` (UUID, FK → `user_account.id`, nullable)
- `event_timestamp` (timestamptz, not null)
- `ip_address` (inet, nullable)
- `user_agent` (text, nullable)
- `metadata_json` (jsonb, nullable)
- `before_json` (jsonb, nullable)
- `after_json` (jsonb, nullable)

### `job_run_log`
**Purpose:** Logs scheduled/manual jobs such as price refreshes and recomputations.

Fields:
- `id` (UUID, PK)
- `job_type`
- `trigger_type`
- `status`
- `started_at`
- `completed_at`
- `summary_json`
- `error_message`
- `created_at`

---

## Optional Derived / Materialised Tables

### `position_snapshot` (derived)
Suggested fields:
- `id`, `portfolio_id`, `asset_id`, `snapshot_timestamp`
- `quantity_held`, `cost_basis_amount`
- `market_price`, `market_price_currency_code`
- `market_value_amount`, `owned_market_value_amount`
- `unrealised_pnl_amount`, `realised_pnl_cumulative_amount`
- `allocation_pct`
- `data_source_summary_json`
- `created_at`

### `portfolio_snapshot` (derived)
Suggested fields:
- `id`, `portfolio_id`, `snapshot_timestamp`
- `total_market_value_amount`, `total_owned_market_value_amount`
- `total_unrealised_pnl_amount`, `total_realised_pnl_amount`
- `cash_value_amount`
- `allocation_by_asset_type_json`, `allocation_by_asset_json`
- `created_at`

### `performance_snapshot` (derived)
Suggested fields:
- `id`, `portfolio_id`
- `period_start`, `period_end`, `as_of_timestamp`
- `twr_return`
- `valuation_start_amount`, `valuation_end_amount`
- `external_cash_flows_amount`
- `calculation_method`, `calculation_version`
- `created_at`

---

## Transaction Types and Semantics (MVP)

### General Ledger Rules
1. Ledger is canonical
2. No direct position editing
3. Replay transactions chronologically:
   - `trade_timestamp` else `trade_date`, then tie-breaker by `created_at`/`id`
4. Exclude soft-deleted rows from calculations
5. No shorting in MVP

### Asset-Type Semantics
**Market assets (`STOCK`, `ETF`, `CRYPTO`)**
- `BUY` increases quantity
- `SELL` decreases quantity
- `FEE` usually reduces cash, not quantity
- Current value = quantity × latest price

**Cash (`CASH`) — recommended MVP model**
- Use `DEPOSIT`, `WITHDRAWAL`, `INTEREST`, `FEE`
- `gross_amount` is primary field
- `quantity` optional/null
- Derived cash balance = sum signed cash impacts

**Real estate (`REAL_ESTATE`)**
- Current value from latest manual valuation
- Ownership % applied to exposure

### Signed Financial Impact Convention
- `BUY` = negative cash impact
- `SELL` = positive cash impact
- `DEPOSIT` = positive
- `WITHDRAWAL` = negative
- `FEE` = negative
- `DIVIDEND` / `INTEREST` = positive
- `ADJUSTMENT` = explicit by purpose

---

## Calculation Rules (MVP)

### Holdings Calculation
Replay non-deleted ledger rows chronologically per asset.

- `BUY`:
  - increase quantity
  - increase cost basis (including allocable fees)
  - create/open lot (if FIFO)
- `SELL`:
  - decrease quantity
  - compute realised P/L
  - consume lots (if FIFO)
- `FEE`:
  - affect cash/P&L per policy
- `ADJUSTMENT`:
  - apply explicit correction with rationale

Outputs per asset:
- quantity held
- remaining cost basis
- realised P/L cumulative
- open lots (if FIFO)
- average cost (if surfaced in UI)

### Cost Basis Method (Recommended MVP)
Use **FIFO** to support lot-level drill-down.

FIFO realised P/L per matched lot:
`(sell_unit_price - buy_unit_price) * matched_quantity - allocable_fees`

### Current Valuation
**Market assets**
- `market_value = quantity_held × latest_price`
- `owned_market_value = market_value × ownership_pct / 100`

**Manual assets / real estate**
- `current_value = latest manual valuation`
- `owned_market_value = current_value × ownership_pct / 100`

**Cash**
- derived cash balance (ownership adjustment optional if shared cash assets supported)

### P/L Rules
- `unrealised_pnl = current_market_value - remaining_cost_basis`
- `realised_pnl` from FIFO matching (or `transaction_lot_link`)
- Ownership % is best treated as a reporting multiplier in MVP

### TWR (MVP)
Use **Daily TWR (`TWR_DAILY_V1`)**.

Treat as external cash flows:
- `DEPOSIT`
- `WITHDRAWAL`

Not external (normally):
- `BUY`, `SELL`, `FEE`, `DIVIDEND`, `INTEREST`

Daily return:
`r_d = (V_end_d - V_start_d - CF_d) / V_start_d`

Chain-link:
`TWR = Π(1 + r_d) - 1`

Store calculation versioning:
- `calculation_method = TWR_DAILY_V1`
- `calculation_version = 1`

### Recommendation Engine Data Rules
Structured deterministic input should include:
- total portfolio value (owned)
- allocations (asset class + asset)
- concentration metrics
- realised/unrealised P&L
- TWR windows
- price freshness / valuation freshness
- risk config targets/limits
- optional trend metrics

Generate `rule_finding` rows before AI synthesis.

---

## Indexing Strategy (MVP)

### Essential Indexes
**`transaction_ledger`**
- `(portfolio_id, trade_date)`
- `(asset_id, trade_date)`
- `(portfolio_id, asset_id, trade_date)`
- partial index excluding deleted rows
- `(external_reference)` if import/sync used

**`price_snapshot`**
- `(asset_id, price_timestamp DESC)`
- `(asset_id, price_date DESC)`
- unique candidate on `(asset_id, provider_id, price_timestamp)`

**`asset_valuation_manual`**
- `(asset_id, valuation_date DESC)`

**`recommendation_run`**
- `(portfolio_id, started_at DESC)`
- `(run_status)`

**`recommendation_item`**
- `(recommendation_run_id)`
- `(asset_id)`

**`audit_log`**
- `(event_timestamp DESC)`
- `(entity_type, entity_id)`

---

## Suggested Enumerations (MVP)
### `asset_type`
`CASH`, `STOCK`, `ETF`, `CRYPTO`, `REAL_ESTATE`, `CUSTOM`

### `transaction_type`
`BUY`, `SELL`, `DEPOSIT`, `WITHDRAWAL`, `FEE`, `ADJUSTMENT`, `DIVIDEND`, `INTEREST`

### `recommendation_type`
`BUY`, `SELL`, `HOLD`, `WATCH`

### `scope_type`
`PORTFOLIO`, `ASSET`

### `run_status`
`STARTED`, `COMPLETED`, `PARTIAL`, `FAILED`

### `severity`
`INFO`, `WARN`, `HIGH`

---

## Data Integrity and Validation Rules (MVP)

### Hard Rules
- No negative holdings for non-cash assets
- `ownership_pct` in `(0, 100]`
- `trade_date` required
- `SELL.quantity <= available_quantity`
- Currency code required on monetary records
- Deleted transactions excluded from calculations

### Soft Rules (Warnings)
- Stale prices beyond threshold
- Stale manual valuations
- Excessive `ADJUSTMENT` usage
- Missing fees on trades (if expected)

---

## Future-Proofing Notes
### Broker Sync (future)
Potential tables:
- `account`
- `broker_connection`
- `import_batch`
- `broker_transaction_map`

### Automated Trading (future)
Potential tables:
- `execution_policy`
- `trade_order`
- `trade_order_attempt`
- `broker_execution_event`
- `risk_guardrail_breach`

Keep execution concerns separate from recommendation records.

### XIRR (later)
No major schema changes needed if ledger + valuation snapshots are present.

---

## Recommended MVP Decisions to Lock In
1. **Cost basis method:** FIFO
2. **Cash model:** cash as asset + deposit/withdrawal transactions; quantity optional
3. **TWR method:** Daily TWR (`TWR_DAILY_V1`)
4. **Ownership handling:** reporting multiplier (do not split lots by ownership in MVP)
5. **Multi-currency:** support asset currency + portfolio base; add `fx_rate_snapshot` when needed
6. **Transaction edits:** allowed, but before/after logged in `audit_log`

## Minimal MVP Table Set (Lean Start)
- `user_account`
- `user_session`
- `portfolio`
- `asset`
- `transaction_ledger`
- `asset_valuation_manual`
- `price_snapshot`
- `portfolio_config_version`
- `recommendation_run`
- `recommendation_item`
- `rule_finding`
- `audit_log`

Then add:
- `transaction_lot_link` (FIFO realised P/L)
- `fx_rate_snapshot` (multi-currency)
- snapshot/cache tables (when needed)
