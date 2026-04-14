# Badgers Investments — Recommendation Specification (v1.1)

## 1. Purpose

This document defines the MVP recommendation engine for **Badgers Investments**. It specifies:

- recommendation objectives,
- deterministic analytics inputs,
- rule catalogue and thresholds,
- output schema,
- scoring,
- AI prompt contract,
- logging and audit requirements,
- fallback behaviour when AI fails.

This spec is implementation-focused and aligned to the MVP constraints:

- single-user
- ledger-first portfolio model
- TWR (daily method)
- explicit **BUY / SELL / HOLD** recommendations
- AI-assisted output via the **`ai` module**, using the **user-configured LLM provider and model** (supported providers product-defined, e.g. OpenAI, Anthropic, Google Gemini); validation and orchestration stay provider-agnostic at the contract level

---

## 2. Recommendation Engine Goals (MVP)

### 2.1 Primary Goal
Produce **actionable, explainable portfolio recommendations** that are grounded in:

1. portfolio state (holdings, allocation, P/L, TWR),
2. risk/config thresholds,
3. deterministic rule findings,
4. optional lightweight market trend signals.

### 2.2 Output Requirement
Each run must produce:

- a **portfolio-level recommendation summary**
- zero or more **asset-level recommendations**
- explicit recommendation types: **BUY / SELL / HOLD** (optionally `WATCH`)
- rationale and assumptions
- data freshness context

### 2.3 Non-Goals (MVP)
- Autonomous execution
- Optimised order sizing / portfolio optimiser
- Tax-aware recommendation logic
- News sentiment scraping
- Fundamental factor models
- Intraday trading signals

---

## 3. Engine Architecture (MVP)

Use a **three-layer pipeline**:

1. **Deterministic analytics layer**  
   Computes holdings, allocation, concentration, P/L, TWR, freshness.

2. **Rule engine layer**  
   Applies portfolio rules and thresholds to produce structured findings.

3. **AI synthesis layer**  
   Consumes structured analytics + rule findings and returns human-readable buy/sell/hold recommendations.

### Design Principle
The engine must remain useful **without AI**. AI improves interpretation and wording, but deterministic rules are the foundation.

---

## 4. Triggering and Run Types

### 4.1 Trigger Types (`recommendation_run.run_trigger_type`)
- `MANUAL` (MVP primary)
- `SCHEDULED` (optional later)
- `SYSTEM` (internal refresh/rebuild)

### 4.2 Run Preconditions (MVP)
A manual recommendation run may proceed if:

- user is authenticated
- active portfolio config exists
- at least one active asset exists
- ledger has at least one non-deleted transaction or one manually valued asset
- valuation state can be computed

If any are missing, return a structured precondition error and do not create a completed run.

---

## 5. Input Data Contract (Deterministic Analytics Payload)

The recommendation engine should generate a **structured analytics payload** before rules/AI. This payload is the canonical input to the rule engine and AI layer.

### 5.1 Payload Requirements
- Must be serialisable JSON
- Must include data timestamps/freshness
- Must be stable enough to hash (`analytics_input_hash`)
- Must be versioned (`analytics_schema_version`)

### 5.2 Suggested Payload Schema (v1)

```json
{
  "analytics_schema_version": "1.0",
  "portfolio": {
    "portfolio_id": "uuid",
    "base_currency": "EUR",
    "as_of_timestamp": "2026-02-22T10:30:00Z",
    "valuation_timestamp": "2026-02-22T10:25:00Z",
    "total_value_owned": 123456.78,
    "total_value_full": 140000.00,
    "cash_value_owned": 15000.00,
    "realised_pnl_total": 4200.00,
    "unrealised_pnl_total": 8600.00,
    "twr": {
      "1m": 0.0123,
      "3m": -0.0211,
      "ytd": 0.0344,
      "1y": 0.0980,
      "all": 0.2145,
      "calculation_method": "TWR_DAILY_V1"
    }
  },
  "config": {
    "config_version_id": "uuid",
    "risk_profile_type": "BALANCED",
    "risk_score": 6,
    "base_currency": "EUR",
    "target_allocations": {
      "CASH": {"target": 10, "min": 5, "max": 20},
      "EQUITIES": {"target": 60, "min": 45, "max": 75},
      "CRYPTO": {"target": 5, "min": 0, "max": 10},
      "REAL_ESTATE": {"target": 25, "min": 10, "max": 40}
    },
    "concentration_limits": {
      "max_single_asset_pct": 20,
      "max_crypto_pct": 10,
      "max_single_sector_pct": 35
    }
  },
  "allocations": {
    "by_asset_type": [
      {"asset_type": "CASH", "value_owned": 15000, "pct_owned": 12.15},
      {"asset_type": "STOCK_ETF", "value_owned": 79000, "pct_owned": 64.00},
      {"asset_type": "CRYPTO", "value_owned": 9500, "pct_owned": 7.69},
      {"asset_type": "REAL_ESTATE", "value_owned": 19956.78, "pct_owned": 16.16}
    ],
    "top_holdings": [
      {
        "asset_id": "uuid",
        "name": "Apple Inc",
        "symbol": "AAPL",
        "asset_type": "STOCK",
        "sector": "Technology",
        "value_owned": 18000,
        "allocation_pct": 14.58,
        "unrealised_pnl": 3200,
        "price_freshness_hours": 2.3
      }
    ]
  },
  "assets": [
    {
      "asset_id": "uuid",
      "name": "Apple Inc",
      "symbol": "AAPL",
      "asset_type": "STOCK",
      "currency": "USD",
      "ownership_pct": 100,
      "quantity_held": 55.0,
      "current_price": 210.12,
      "current_value_owned": 11556.60,
      "cost_basis": 9800.00,
      "unrealised_pnl": 1756.60,
      "realised_pnl_cumulative": 230.00,
      "allocation_pct": 9.36,
      "price_freshness_hours": 2.3,
      "has_stale_price": false,
      "trend_signals": {
        "enabled": false
      }
    }
  ],
  "quality": {
    "asset_count": 12,
    "market_asset_count": 8,
    "priced_asset_count": 8,
    "stale_price_asset_count": 1,
    "manual_valuation_asset_count": 2,
    "stale_manual_valuation_count": 1,
    "warnings": [
      "One real estate valuation older than 90 days"
    ]
  }
}
```

---

## 6. Deterministic Metrics (MVP)

These metrics must be computed before rules/AI.

### 6.1 Portfolio-Level Metrics
- `total_value_owned` (base currency)
- `total_value_full` (optional)
- `cash_value_owned`
- `realised_pnl_total`
- `unrealised_pnl_total`
- TWR by time window (at least one required; ideally multiple)
- allocation by asset type
- allocation by asset
- concentration metrics (top 1 / top 3 / top 5)
- crypto allocation %
- stale-price counts / stale valuation counts

### 6.2 Asset-Level Metrics
For each active asset (where applicable):
- current owned value
- allocation %
- cost basis
- unrealised P/L
- realised P/L cumulative
- price freshness hours
- sector (if known)
- optional trend signals (MVP optional)

### 6.3 Freshness Metrics
Use to gate recommendation confidence:
- `price_freshness_hours` for market assets
- `manual_valuation_age_days` for manual assets
- `valuation_timestamp` for overall run

---

## 7. Rule Engine Specification (MVP)

### 7.1 Rule Engine Behaviour
- Evaluate all enabled rules on each run
- Emit `rule_finding` rows for triggered findings
- Rules may be:
  - `INFO`
  - `WARN`
  - `HIGH`
- AI receives triggered findings plus selected non-triggered context if useful (optional)

### 7.2 Rule Categories
1. **Data Quality & Freshness**
2. **Allocation Drift**
3. **Concentration Risk**
4. **Liquidity / Cash Buffer**
5. **Performance Review Flags**
6. **Portfolio Hygiene**

---

## 8. Rule Catalogue (v1)

Below is the recommended MVP rule set with codes, inputs, logic, and suggested output semantics.

### 8.1 Data Quality & Freshness Rules

#### R001 — `STALE_PRICE_CRITICAL_ASSET`
**Purpose:** Flag stale market prices that reduce recommendation reliability.

- **Scope:** ASSET
- **Severity:** `WARN` or `HIGH` (depending on staleness)
- **Inputs:** `asset.price_freshness_hours`, `asset.allocation_pct`
- **Logic (default):**
  - Trigger `WARN` if market asset price age > 48h and allocation ≥ 5%
  - Trigger `HIGH` if market asset price age > 120h and allocation ≥ 5%
- **Default recommendation effect:** bias towards `HOLD/WATCH`, reduce confidence
- **Finding text example:** “Price data for AAPL is 72 hours old; recommendation confidence reduced.”

#### R002 — `STALE_MANUAL_VALUATION`
**Purpose:** Flag stale real estate/manual valuations.

- **Scope:** ASSET
- **Severity:** `WARN`
- **Inputs:** latest manual valuation age (days), allocation %
- **Logic (default):**
  - Trigger if manual valuation age > 90 days and asset allocation ≥ 5%
- **Effect:** recommendation caution for affected asset/portfolio

#### R003 — `INSUFFICIENT_MARKET_COVERAGE`
**Purpose:** Portfolio-level quality check for missing prices.

- **Scope:** PORTFOLIO
- **Severity:** `HIGH`
- **Inputs:** `market_asset_count`, `priced_asset_count`
- **Logic (default):**
  - Trigger if `priced_asset_count / market_asset_count < 0.8`
- **Effect:** suppress strong BUY/SELL portfolio-wide unless AI explicitly notes degraded reliability

### 8.2 Allocation Drift Rules

#### R101 — `ALLOCATION_BELOW_MIN`
**Purpose:** Flag asset-class allocation below configured minimum.

- **Scope:** PORTFOLIO
- **Severity:** `WARN`
- **Inputs:** actual asset-class allocation %, config min %
- **Logic:**
  - Trigger if `actual_pct < min_pct`
- **Metrics JSON example:**
  ```json
  {"bucket":"CASH","actual_pct":3.2,"min_pct":5.0,"delta_pct":-1.8}
  ```
- **Typical recommendation implication:** BUY/ADD exposure to underweight bucket (or HOLD if deliberate)

#### R102 — `ALLOCATION_ABOVE_MAX`
**Purpose:** Flag asset-class allocation above configured maximum.

- **Scope:** PORTFOLIO
- **Severity:** `WARN` (or `HIGH` if materially exceeded)
- **Inputs:** actual %, config max %
- **Logic:**
  - Trigger `WARN` if `actual_pct > max_pct`
  - Escalate to `HIGH` if `(actual_pct - max_pct) >= 5 percentage points`
- **Typical implication:** SELL/trim or HOLD with justification

#### R103 — `ALLOCATION_DRIFT_TARGET`
**Purpose:** Highlight meaningful drift from target even if still within min/max band.

- **Scope:** PORTFOLIO
- **Severity:** `INFO`
- **Inputs:** actual %, target %
- **Logic (default):**
  - Trigger if `abs(actual_pct - target_pct) >= drift_alert_threshold`
  - `drift_alert_threshold` default = 5 percentage points
- **Effect:** rebalance consideration, often `HOLD` or soft `BUY/SELL`

### 8.3 Concentration Risk Rules

#### R201 — `CONCENTRATION_SINGLE_ASSET_EXCEEDED`
**Purpose:** Limit concentration in one asset.

- **Scope:** ASSET + PORTFOLIO
- **Severity:** `HIGH`
- **Inputs:** asset allocation %, `max_single_asset_pct`
- **Logic:**
  - Trigger if `asset_allocation_pct > max_single_asset_pct`
- **Typical implication:** `SELL` or partial trim recommendation

#### R202 — `CONCENTRATION_SINGLE_ASSET_WARNING`
**Purpose:** Early warning before hard concentration breach.

- **Scope:** ASSET
- **Severity:** `WARN`
- **Inputs:** asset allocation %, warning threshold
- **Logic (default):**
  - warning threshold = 90% of `max_single_asset_pct`
  - Trigger if `asset_allocation_pct > 0.9 * max_single_asset_pct` and not already HIGH
- **Typical implication:** `HOLD` or `WATCH`, prepare to trim

#### R203 — `CONCENTRATION_CRYPTO_EXCEEDED`
**Purpose:** Enforce crypto risk limit.

- **Scope:** PORTFOLIO
- **Severity:** `HIGH`
- **Inputs:** total crypto allocation %, `max_crypto_pct`
- **Logic:**
  - Trigger if `crypto_pct > max_crypto_pct`
- **Typical implication:** `SELL` / reduce crypto exposure

#### R204 — `CONCENTRATION_SECTOR_EXCEEDED` (optional MVP if sector data available)
**Purpose:** Limit sector overexposure.

- **Scope:** PORTFOLIO
- **Severity:** `WARN`/`HIGH`
- **Inputs:** sector allocation %, `max_single_sector_pct`
- **Logic:**
  - Trigger if sector allocation > configured max
- **Note:** Only enable if sector mapping quality is adequate.

### 8.4 Liquidity / Cash Buffer Rules

#### R301 — `CASH_BELOW_MINIMUM`
**Purpose:** Ensure minimum liquidity buffer.

- **Scope:** PORTFOLIO
- **Severity:** `WARN` or `HIGH`
- **Inputs:** cash allocation %, cash minimum %
- **Logic:**
  - Trigger `WARN` if cash % < min %
  - Trigger `HIGH` if cash % < (min % - 3pp)
- **Typical implication:** `HOLD` on new buys; `SELL`/reduce risk or add cash via deposit

#### R302 — `CASH_ABOVE_MAXIMUM`
**Purpose:** Flag idle cash that exceeds desired allocation.

- **Scope:** PORTFOLIO
- **Severity:** `INFO`/`WARN`
- **Inputs:** cash allocation %, cash max %
- **Logic:**
  - Trigger if cash % > max %
- **Typical implication:** `BUY`/deploy cash gradually, if other conditions allow

### 8.5 Performance Review Rules (MVP lightweight)

These are diagnostic, not momentum trading signals.

#### R401 — `LARGE_UNREALISED_GAIN_CONCENTRATED`
**Purpose:** Encourage review of outsized gain concentration.

- **Scope:** ASSET
- **Severity:** `INFO`/`WARN`
- **Inputs:** unrealised gain %, allocation %
- **Logic (default):**
  - Trigger if asset has unrealised gain > 25% **and** allocation > 15%
- **Typical implication:** consider trim / rebalance (not automatic SELL)

#### R402 — `LARGE_UNREALISED_LOSS_REVIEW`
**Purpose:** Force explicit review of material losers.

- **Scope:** ASSET
- **Severity:** `WARN`
- **Inputs:** unrealised loss %, allocation %
- **Logic (default):**
  - Trigger if unrealised loss < -20% and allocation > 5%
- **Typical implication:** HOLD vs SELL depends on thesis; AI must provide rationale

#### R403 — `NEGATIVE_TWR_RECENT`
**Purpose:** Highlight poor recent portfolio performance.

- **Scope:** PORTFOLIO
- **Severity:** `INFO`/`WARN`
- **Inputs:** TWR windows (`1m`, `3m`)
- **Logic (default):**
  - Trigger `INFO` if 1M TWR < 0
  - Trigger `WARN` if 3M TWR < -5%
- **Typical implication:** review risk and concentration, not blanket SELL

### 8.6 Portfolio Hygiene Rules

#### R501 — `EXCESSIVE_ADJUSTMENTS_USAGE`
**Purpose:** Warn that too many manual adjustments may undermine trust in data.

- **Scope:** PORTFOLIO
- **Severity:** `INFO`/`WARN`
- **Inputs:** adjustment count over recent period
- **Logic (default):**
  - Trigger if >3 adjustments in 30 days
- **Effect:** lower confidence in precise recommendations

#### R502 — `NO_ACTIVE_CONFIG_TARGETS`
**Purpose:** Ensure config is usable.

- **Scope:** PORTFOLIO
- **Severity:** `HIGH`
- **Inputs:** config validity
- **Logic:**
  - Trigger if target allocation or concentration limits missing/invalid
- **Effect:** abort or degrade recommendation run

---

## 9. Rule Evaluation Order and Gating

### 9.1 Suggested Evaluation Order
1. Config validity rules
2. Data quality/freshness rules
3. Allocation drift
4. Concentration risk
5. Liquidity/cash buffer
6. Performance review
7. Hygiene

### 9.2 Recommendation Confidence Gating
Certain findings should reduce confidence or prevent strong recommendations:

#### Hard-gate examples (MVP)
If any are true:
- `INSUFFICIENT_MARKET_COVERAGE` (`HIGH`)
- `NO_ACTIVE_CONFIG_TARGETS` (`HIGH`)
then:
- AI may still produce recommendations, but engine should annotate output with **degraded reliability**
- optionally suppress `BUY/SELL` and default to `HOLD/WATCH` for asset-level calls (configurable)

#### Soft-gate examples
If stale price/valuation rules fire on high-allocation assets:
- reduce confidence score
- require AI to mention data freshness caveat

---

## 10. Recommendation Decision Logic (Deterministic Layer)

The MVP should produce a **deterministic recommendation baseline** before AI. AI can rephrase and refine but should not contradict hard constraints without explanation.

### 10.1 Baseline Output Categories
- `BUY`
- `SELL`
- `HOLD`
- `WATCH` (optional internal/intermediate)

### 10.2 Portfolio-Level Baseline Heuristics (MVP)
These are heuristics, not exact optimiser outputs.

#### SELL Bias (portfolio-level)
Set portfolio-level bias towards risk reduction if any `HIGH`:
- `CONCENTRATION_SINGLE_ASSET_EXCEEDED`
- `CONCENTRATION_CRYPTO_EXCEEDED`
- `CASH_BELOW_MINIMUM` (with over-risk profile context)
- severe stale data may instead force `HOLD/WATCH`

#### BUY Bias (portfolio-level)
Set portfolio-level bias towards deployment if:
- `CASH_ABOVE_MAXIMUM`
- underweight target bucket(s) with good data coverage
- no severe concentration breaches

#### HOLD Bias (portfolio-level)
Default to `HOLD` if:
- allocations broadly within bands
- no severe data quality issues
- no major concentration breach
- no urgent liquidity issue

### 10.3 Asset-Level Baseline Heuristics (MVP)
Examples:
- asset breaches `max_single_asset_pct` → baseline `SELL`
- asset near concentration warning + high gains → baseline `WATCH` or `SELL`
- asset in underweight target category + no concentration/data issues → candidate `BUY`
- stale pricing / stale valuation → baseline `HOLD` or `WATCH`
- no triggered concerns and no strong opportunity signal → `HOLD`

### Important
In v1, “BUY opportunities” should generally be framed as:
- **bucket-level first** (e.g., “Increase cash / reduce crypto / add equities”)
- asset-level BUY only when there is a clear reason (e.g., underweight core ETF already tracked, or watchlist support later)

---

## 11. Scoring and Ranking (MVP)

Scoring should be simple and explainable.

### 11.1 Strength Score (`strength_score`, 0–100)
Represents action urgency/importance.

#### Suggested initial scoring formula (heuristic)
- Start at 50
- Add/subtract based on triggered rules:
  - `HIGH`: +25
  - `WARN`: +10
  - `INFO`: +3
- Increase if allocation deviation is large:
  - +1 per percentage point above max / below min (cap +20)
- Decrease for stale data:
  - -10 if stale price >48h on relevant asset
  - -20 if stale >120h
- Clamp to `[0, 100]`

Interpretation:
- `0–29`: weak / informational
- `30–59`: moderate
- `60–79`: strong
- `80–100`: urgent review

### 11.2 Confidence Score (`confidence_score`, 0–100)
Represents confidence in recommendation quality based on data completeness/freshness.

#### Suggested initial confidence model
Start at 90, then penalise:
- missing prices for market assets:
  - `-15` if coverage < 100%
  - `-30` if coverage < 80%
- stale high-allocation asset price:
  - `-10` each (cap -30)
- stale manual valuation on >10% asset:
  - `-10`
- excessive adjustments:
  - `-5`
- AI failure:
  - confidence still valid for deterministic findings, but mark `ai_status = FAILED`

Clamp to `[0, 100]`.

### 11.3 Priority Ranking
Sort recommendations by:
1. severity (`HIGH` > `WARN` > `INFO`)
2. strength score desc
3. allocation impact desc
4. asset name asc (stable tie-breaker)

---

## 12. Output Schema (Stored Recommendation Results)

### 12.1 `recommendation_run` Requirements
Each run must persist:
- config version used
- valuation timestamp / freshness summary
- analytics hash
- run status
- AI metadata and status
- portfolio summary text (if available)

### 12.2 `recommendation_item` Requirements
Each item must include:
- scope (`PORTFOLIO` or `ASSET`)
- recommendation type (`BUY`/`SELL`/`HOLD`/`WATCH`)
- rationale (required)
- strength and confidence (recommended)
- optional headline
- assumptions/caveats
- optional structured action JSON

### 12.3 Suggested `suggested_action_json` Shapes

#### Portfolio-level rebalance suggestion
```json
{
  "action_type": "REBALANCE_GUIDANCE",
  "changes": [
    {"bucket": "CRYPTO", "direction": "DECREASE", "reason": "max allocation exceeded"},
    {"bucket": "CASH", "direction": "INCREASE", "reason": "below minimum liquidity threshold"}
  ]
}
```

#### Asset-level trim suggestion
```json
{
  "action_type": "TRIM_POSITION",
  "asset_id": "uuid",
  "direction": "SELL",
  "reason_code": "CONCENTRATION_SINGLE_ASSET_EXCEEDED",
  "target_allocation_pct": 20.0
}
```

#### Asset-level hold suggestion
```json
{
  "action_type": "HOLD_REVIEW",
  "asset_id": "uuid",
  "review_conditions": [
    "refresh price data",
    "reassess thesis if loss exceeds 30%"
  ]
}
```

---

## 13. AI Synthesis Layer Specification

### 13.1 Purpose of AI in v1
AI should:
- explain deterministic findings,
- convert findings into readable buy/sell/hold recommendations,
- identify trade-offs and assumptions,
- improve clarity and prioritisation.

AI should **not** invent data or override hard constraints silently.

### 13.2 AI Input Contract
AI receives:
1. system instruction (fixed prompt)
2. analytics payload JSON (structured)
3. triggered rule findings
4. deterministic baseline recommendations (optional but recommended)
5. output schema instruction

### 13.3 AI Output Contract (Strict JSON Recommended)
Require AI to output JSON matching a strict schema, then validate server-side.

#### Suggested AI Output Schema
```json
{
  "portfolio_summary": {
    "recommendation_type": "HOLD",
    "headline": "Portfolio is broadly balanced but requires a trim in crypto exposure",
    "rationale": "Crypto allocation exceeds configured maximum while cash remains within range...",
    "assumptions": "Based on latest available prices and current target allocation settings.",
    "strength_score": 68,
    "confidence_score": 82
  },
  "items": [
    {
      "scope_type": "ASSET",
      "asset_id": "uuid",
      "recommendation_type": "SELL",
      "headline": "Trim BTC position",
      "rationale": "BTC contributes to crypto allocation above configured max and increases concentration risk.",
      "assumptions": "No short-term tax constraint modelled.",
      "strength_score": 74,
      "confidence_score": 80,
      "reason_codes": ["CONCENTRATION_CRYPTO_EXCEEDED"]
    }
  ],
  "disclaimer_note": "Personal-use decision support output generated from configured rules and current portfolio data."
}
```

### 13.4 Validation Rules for AI Output
Server must validate:
- valid JSON
- allowed enums only
- `rationale` present on all items
- `asset_id` present iff `scope_type = ASSET`
- scores within 0–100
- no references to unknown assets
- no empty item arrays if portfolio_summary absent

If invalid:
- mark `ai_status = FAILED`
- fall back to deterministic output

---

## 14. Prompt Contract (Implementation Guidance)

### 14.1 System Prompt Requirements (High Level)
The system prompt should instruct the model to:

- act as a portfolio analysis assistant for personal-use decision support
- use **only** provided data and findings
- not fabricate metrics or prices
- prioritise risk/config breaches and data freshness caveats
- produce explicit buy/sell/hold calls
- return strict JSON only
- explain rationale and assumptions concisely

### 14.2 User Prompt Payload Sections
Send as structured JSON/text blocks:
1. metadata (run id, schema version)
2. portfolio config
3. analytics summary
4. rule findings
5. optional deterministic baseline items
6. required response schema

### 14.3 Prompt Versioning
Store `ai_prompt_version` in `recommendation_run` so changes are traceable.

Suggested convention:
- `REC_V1_0`
- `REC_V1_1` (minor wording changes)
- `REC_V2_0` (schema changes)

---

## 15. Fallback Behaviour (AI Failure / Degraded Mode)

The system must remain operational if AI fails.

### 15.1 Failure Conditions
- API key missing/invalid
- provider timeout
- rate limit
- network error
- invalid AI response JSON
- validation failure

### 15.2 Fallback Output Requirements
If AI fails:
- set `recommendation_run.run_status = PARTIAL` (or `COMPLETED` with `ai_status=FAILED`; choose one policy and keep consistent)
- persist deterministic `rule_finding` rows
- generate deterministic portfolio/asset recommendations using baseline heuristics
- mark output as “AI unavailable; deterministic rules only”
- include confidence penalties if data quality issues exist

### 15.3 Deterministic Fallback Item Format
Fallback items should still populate `recommendation_item` with:
- `recommendation_type`
- `rationale` (rule-based)
- `strength_score`
- `confidence_score`
- `headline` (optional)

This keeps UI consistent.

---

## 16. Logging, Audit, and Reproducibility

### 16.1 `recommendation_run` Logging Requirements
Persist:
- `started_at`, `completed_at`, status
- config version id
- valuation timestamp
- analytics input hash
- AI provider/model/prompt version
- AI status and error message (if any)

### 16.2 `rule_finding` Logging Requirements
Persist one row per triggered rule with:
- `rule_code`
- `severity`
- scope
- `metrics_json`
- finding text

### 16.3 Reproducibility Requirements
To reproduce a run later, the system should be able to identify:
- config version
- rule set version
- analytics schema version
- TWR calculation version
- AI prompt version
- data freshness state (and ideally valuation timestamp/prices used)

#### Add These Version Fields (recommended)
To `recommendation_run` (if not already present):
- `rule_set_version` (varchar) e.g., `RULES_V1`
- `analytics_schema_version` (varchar)
- `calculation_method_version` (varchar) e.g., `TWR_DAILY_V1`

---

## 17. Rule Set Versioning and Configuration

### 17.1 Rule Set Version
Define a static version string for MVP:
- `RULES_V1`

Store it in each run.

### 17.2 Threshold Sources
Thresholds may come from:
1. `portfolio_config_version` (user-configurable)
2. engine defaults (hard-coded fallback)
3. rule-specific constants (e.g., stale threshold defaults)

#### Precedence
1. explicit config value
2. risk-profile defaults
3. global engine defaults

### 17.3 Enable/Disable Rules (MVP)
MVP can keep rules always enabled except:
- sector rules if sector data unavailable
- trend-based rules if trend signals disabled

Later, add per-rule toggles.

---

## 18. Minimal Deterministic Fallback Rule-to-Recommendation Mapping (MVP)

This is the baseline mapping for AI failure and for producing pre-AI heuristics.

### 18.1 Portfolio-Level Mapping
- `CONCENTRATION_CRYPTO_EXCEEDED (HIGH)` → portfolio `SELL` (reduce crypto exposure)
- `ALLOCATION_BELOW_MIN` for `CASH` + cash low severity → portfolio `HOLD`/`SELL-RISK` bias (prefer raising cash)
- `CASH_ABOVE_MAXIMUM` + no severe breaches → portfolio `BUY` (deploy excess cash)
- no WARN/HIGH findings → portfolio `HOLD`

### 18.2 Asset-Level Mapping
- `CONCENTRATION_SINGLE_ASSET_EXCEEDED` → asset `SELL`
- `CONCENTRATION_SINGLE_ASSET_WARNING` + large gains → `WATCH` or `SELL`
- `STALE_PRICE_CRITICAL_ASSET` → `HOLD` (defer action until refresh)
- `LARGE_UNREALISED_LOSS_REVIEW` → `HOLD` or `SELL` only if other risk breaches exist
- no triggered asset-specific rules → `HOLD`

### Note
MVP asset-level BUY calls should be conservative unless you include explicit watchlist/core-position logic.

---

## 19. API/Service Interface Draft (Internal)

### 19.1 Service Method
Suggested internal service API:

```ts
runRecommendation(input: {
  portfolioId: string;
  triggerType: "MANUAL" | "SCHEDULED" | "SYSTEM";
  requestedByUserId?: string;
  options?: {
    includeAi?: boolean;          // default true
    forcePriceRefresh?: boolean;  // default false
    timeWindowSet?: string;       // e.g. "DEFAULT"
  };
}): Promise<RecommendationRunResult>
```

### 19.2 Result Shape (Internal)
```ts
type RecommendationRunResult = {
  recommendationRunId: string;
  runStatus: "COMPLETED" | "PARTIAL" | "FAILED";
  aiStatus: "SUCCESS" | "FAILED" | "NOT_USED";
  portfolioSummary?: RecommendationItemDto;
  items: RecommendationItemDto[];
  findings: RuleFindingDto[];
  warnings: string[];
};
```

---

## 20. Testing Requirements (MVP)

### 20.1 Unit Tests
Must cover:
- rule logic for each active rule
- threshold edge cases (exactly at min/max, just above/below)
- scoring clamps (0–100)
- confidence penalties
- fallback mapping

### 20.2 Integration Tests
Must cover:
- end-to-end run with valid config and data
- AI success path with valid JSON
- AI invalid JSON fallback path
- missing price data / stale price path
- missing config path (high severity or abort)

### 20.3 Regression Fixtures (Recommended)
Create fixed portfolio fixtures:
1. balanced portfolio (mostly HOLD)
2. concentrated stock portfolio (SELL trim)
3. over-crypto portfolio (SELL crypto)
4. excess cash portfolio (BUY deploy)
5. stale data portfolio (HOLD/WATCH, reduced confidence)

---

## 21. MVP Defaults (Recommended)

These are good starting defaults if config does not specify values explicitly.

### Freshness
- market price stale warning: `48h`
- market price stale high: `120h`
- manual valuation stale warning: `90 days`

### Drift and Concentration
- drift alert threshold: `5pp`
- single asset concentration max: from config (fallback `20%`)
- crypto allocation max: from config (fallback `10%`)
- sector concentration max: from config (fallback `35%`, only if enabled)

### Cash
- cash min/max from config (fallback profile-based defaults)

### Scoring
- severity weights: `HIGH +25`, `WARN +10`, `INFO +3`
- confidence base: `90`

