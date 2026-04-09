# Badgers Investments — Product Strategy (v1.1)

## 1. Executive Summary

Badgers Investments is a personal investment monitoring and recommendation product for a single user (version 1). It consolidates wealth across multiple asset classes, derives holdings from a transaction ledger, and produces explicit **buy/sell/hold** recommendations using a deterministic rules engine with AI-assisted explanation.

The strategy for v1 is to build a **high-trust, ledger-first decision support tool** that is useful immediately without requiring broker integrations or automation.

---

## 2. Product Vision

Create a personal investment operating system that gives a clear picture of wealth, portfolio risk, and recommended actions, with strong auditability and future extensibility towards broker sync and controlled auto-trading.

---

## 3. Problem Statement

Managing investments across savings, equities, crypto, and real estate is fragmented. Common tools either:

- focus on one asset class,
- provide weak portfolio guidance,
- do not support personal preferences/risk thresholds,
- or lack transparency in how recommendations are generated.

You want a tool that combines:
- accurate portfolio tracking,
- explainable analysis,
- and direct recommendations for personal use.

---

## 4. Target User and Scope

## 4.1 Primary User (v1)
- Single user only (you)

## 4.2 User Profile
- Technical, comfortable with configuration
- Accepts manual data entry in exchange for control
- Wants explicit recommendations and is aware of implications
- Low traffic / single-session usage pattern

## 4.3 Scope Boundary (v1)
- Personal decision support only
- No multi-user collaboration
- No public SaaS onboarding
- No automated execution

---

## 5. Strategic Positioning

## 5.1 Core Positioning
A **ledger-first personal portfolio intelligence tool** with explainable recommendations.

## 5.2 Differentiators (for your use case)
1. **Transaction-ledger source of truth**
2. **Cross-asset wealth view** (cash, stocks/ETFs, crypto, real estate)
3. **Explicit buy/sell/hold calls**
4. **Rules + AI hybrid design** (explainable core, AI for synthesis)
5. **Future-ready architecture** for broker sync and auto-trading

## 5.3 What v1 is *not*
- A robo-advisor
- A tax engine
- A brokerage replacement
- A high-frequency or intraday trading platform

---

## 6. Product Goals (v1)

## 6.1 Primary Goals
1. Provide a consolidated view of current wealth.
2. Track holdings and P/L accurately from a transaction ledger.
3. Produce actionable portfolio recommendations with rationale.
4. Support repeatable weekly/monthly review workflows.
5. Establish an architecture that can later support integrations and automation.

## 6.2 Success Criteria (Qualitative)
- The product becomes your default place to review portfolio state.
- Recommendations are useful enough to influence decisions.
- You trust the numbers because they are traceable back to ledger entries.
- The tool remains usable even when AI or data providers fail.

---

## 7. Strategic Principles

1. **Accuracy before automation**
   - Auto-trading is future scope; correctness and trust come first.

2. **Deterministic core, AI on top**
   - AI should explain and prioritise; it should not replace core calculations.

3. **Auditability by design**
   - Every recommendation run should be traceable to data and config versions.

4. **Simple architecture for v1**
   - Build the minimum reliable system for one user.

5. **Design for extension, not premature scale**
   - Modular adapters for market data and AI providers.

---

## 8. Product Pillars

## 8.1 Wealth Visibility
Unified dashboard for:
- total portfolio value,
- allocation,
- P/L,
- and trends.

## 8.2 Portfolio Discipline
Rules-based checks for:
- concentration risk,
- allocation drift,
- cash buffer,
- and data freshness.

## 8.3 Decision Support
Actionable outputs:
- BUY / SELL / HOLD
- with rationale and assumptions.

## 8.4 Trust and Control
- Ledger-first derivation
- Manual overrides via explicit transactions/adjustments
- Audit logging
- Configurable risk preferences

---

## 9. MVP Strategy

## 9.1 Why Manual-First in v1
Manual entry reduces integration complexity and allows:
- faster delivery,
- better control of data quality,
- clearer debugging of calculations,
- and a stronger foundation for later sync features.

## 9.2 Why Rules + AI (instead of AI-only)
AI-only outputs are difficult to trust for financial decisions. A rules + AI approach:
- preserves explainability,
- creates deterministic fallbacks,
- and supports reproducible recommendation runs.

## 9.3 Why Single User
Single-user scope dramatically simplifies:
- auth model,
- tenancy,
- performance requirements,
- and operational cost.

This enables higher-quality implementation of the core portfolio and recommendation logic.

---

## 10. Product Scope by Phase

## 10.1 MVP (Phase 1)
- Username + password login (password stored hashed in DynamoDB) with DynamoDB-backed sessions
- Asset management
- Transaction ledger
- Wealth dashboard
- Holdings and lot drill-down
- Price snapshots
- TWR (daily method)
- Portfolio config (risk/targets/limits)
- Recommendation engine (rules + AI)
- Audit logs
- Local + cloud deployment

## 10.2 Phase 2 (Post-MVP)
- XIRR
- Better indicators (e.g., MACD/RSI)
- Read-only broker sync / CSV imports
- Watchlists and alerts
- Improved recommendation ranking and history UX

## 10.3 Phase 3 (Future)
- Controlled trade execution support
- Broker integrations for order placement
- Risk guardrails for automated execution
- Approval workflows and allocation constraints

---

## 11. Business and Value Strategy (Personal Product Context)

Although this is a personal product in v1, treat it like an investment-grade internal tool.

### Value Created
- Better portfolio decisions
- Time savings in portfolio review
- More consistent risk management
- Reduced fragmentation across accounts/assets

### Cost Strategy
- Use free market data providers where viable
- Pay only where data quality or reliability materially improves outcomes
- Cloud architecture should be minimal and cost-efficient due to low usage

---

## 12. Data Provider Strategy (v1)

## 12.1 Requirements
You need providers for:
- market prices (stocks/ETFs)
- crypto prices
- optionally FX rates (if multi-currency)
- optionally historical prices for charts

## 12.2 Selection Principles
1. Sufficient symbol coverage for your portfolio
2. Reasonable historical data access
3. Stable API / library ecosystem
4. Cost aligned with personal use
5. Clear provider abstraction in code (easy to swap later)

## 12.3 Strategy Recommendation
- For the MVP, enter prices and FX rates manually and store them as snapshots in the database
- Introduce a single low-cost/free market data provider only when manual entry becomes a clear bottleneck
- Regardless of provider choice, always store snapshots locally in DB to reduce repeat calls and support reproducibility

---

## 13. Recommendation Strategy (v1)

## 13.1 Recommendation Definition
A recommendation is an explicit **BUY / SELL / HOLD** call (optionally `WATCH`) for:
- portfolio-level actions (rebalance/de-risk/deploy cash)
- asset-level actions (trim/hold/add, where justified)

## 13.2 Tone and Strength
Because this is personal-use only and you requested strong calls:
- recommendations may be direct,
- but must include rationale, assumptions, and data freshness caveats.

## 13.3 Safety/Trust Strategy
- deterministic rule findings first
- AI synthesis second
- fallback to non-AI recommendations if provider fails
- log run metadata (model, prompt version, timestamps)

---

## 14. Technical Strategy (v1)

## 14.1 Architecture Strategy
Keep the system simple and modular:
- Separate Svelte frontend SPA, Fastify-based Node.js backend API, and worker runtime
- Amazon DynamoDB for application persistence
- service modules for ledger, valuation, recommendations
- provider adapters for market data and AI

## 14.2 Deployment Strategy
- Development locally
- Production in cloud (AWS preferred)
- HTTPS only in production
- environment-based config for secrets and provider settings

## 14.3 Security Strategy
- username + password authentication (password stored hashed in DB)
- encrypted secret storage
- session security and audit logs

---

## 15. Key Product Risks and Mitigations

## 15.1 Risk: Incorrect portfolio calculations
**Mitigation**
- ledger-first model
- deterministic replay
- test fixtures for known portfolios
- audit trails for edits

## 15.2 Risk: AI hallucination or invalid output
**Mitigation**
- strict structured input
- JSON schema validation
- deterministic fallback
- AI metadata logging

## 15.3 Risk: Data provider gaps/stale prices
**Mitigation**
- data freshness indicators
- rule-based confidence penalties
- snapshot persistence
- provider abstraction

## 15.4 Risk: Scope creep (sync/automation too early)
**Mitigation**
- enforce phase boundaries
- prioritise correctness, visibility, and recommendation quality in v1

---

## 16. Success Metrics (Practical v1 Metrics)

For a single-user product, success should be tracked with pragmatic product metrics:

### Usage Metrics
- Weekly review sessions completed
- Recommendation runs per week
- Time to complete review workflow

### Product Quality Metrics
- Recommendation runs completed successfully (%)
- AI failure fallback success rate
- Price refresh success rate
- Calculation regression test pass rate

### Trust Metrics (qualitative/manual)
- Perceived usefulness of recommendations
- Perceived confidence in portfolio values and P/L
- Frequency of manual corrections/adjustments

---

## 17. Strategic Decisions Already Locked

- **v1 audience:** only you
- **recommendation style:** strong buy/sell/hold calls acceptable
- **source of truth:** transaction ledger
- **returns:** TWR now, XIRR later
- **auth:** username + password (hashed)
- **hosting:** local dev, cloud prod

---

## 18. Out of Scope for MVP (Explicitly)

- Auto-trading execution
- Email OTP login
- SMS OTP
- Multi-user admin/user manager
- Advanced sentiment scraping
- Enterprise-grade scaling architecture
- Tax optimisation and reporting
- Public onboarding/billing

