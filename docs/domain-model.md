# Badgers Investments — Domain Model (DynamoDB, MVP)

## Scope and Design Intent
This domain model is for the MVP and is designed around:
- single user
- transaction ledger as source of truth
- derived holdings/snapshots (not manually edited)
- daily TWR (`TWR_DAILY_V1`)
- buy/sell/hold recommendations with rationale
- low-traffic, ultra-low-cost production hosting

Key design priorities:
- correctness and reproducibility
- deterministic recomputation (snapshots can be rebuilt)
- separation of canonical facts (ledger/prices/config) from derived outputs (snapshots/recommendations)
- DynamoDB access-pattern-driven modeling

---

## Conceptual Domain Objects (logical)

**Identity and Security**
- `UserAccount`
- `UserSession`

**Portfolio and Assets**
- `Portfolio`
- `Asset`
- `AssetValuationManual`

**Ledger and Accounting**
- `Transaction` (canonical ledger)
- `LotLink` (optional FIFO support)

**Market Data**
- `PriceSnapshot`
- `FxRateSnapshot`

**Recommendations**
- `PortfolioConfigVersion`
- `RecommendationRun`
- `RecommendationItem`
- `RuleFinding`

**Operations**
- `AuditLog`
- `JobRunLog` (future, when scheduled jobs are introduced)

---

## DynamoDB Physical Model (single-table)

### Table
One table per environment, e.g. `badgers-investments-prod-ddb`.

- **Primary key**: `PK` (partition key, string), `SK` (sort key, string)
- **GSI1**: `GSI1PK`, `GSI1SK` (both string)
- **TTL**: `ttl` (number, epoch seconds) for expirable records (sessions, challenges if ever reintroduced)

### Item type convention
Every item includes:
- `entityType` (string discriminator)
- entity attributes
- optional `createdAt`, `updatedAt`

---

## Key patterns (recommended)

### Tenanting / user partitioning
Single-user MVP still uses explicit user scoping:
- `PK = USER#<userId>`

### Example item shapes (indicative)

#### User account
- `PK = USER#<userId>`
- `SK = ACCOUNT`
- Attributes: `username`, `passwordHash`, `isActive`, timestamps

#### Sessions (revocable, server-side)
- `PK = USER#<userId>`
- `SK = SESSION#<sessionId>`
- Attributes: `expiresAt`, `lastSeenAt`, `isRevoked`, `ip`, `userAgent`, `ttl`

If you need lookup by `sessionId` without knowing `userId`, add:
- `GSI1PK = SESSION#<sessionId>`
- `GSI1SK = USER#<userId>`

#### Portfolio (logical container)
- `PK = USER#<userId>`
- `SK = PORTFOLIO#<portfolioId>`

#### Assets
- `PK = USER#<userId>`
- `SK = ASSET#<assetId>`
- Optional secondary lookup: `GSI1PK = PORTFOLIO#<portfolioId>`, `GSI1SK = ASSET#<assetId>`

#### Ledger transactions (canonical)
- `PK = USER#<userId>`
- `SK = TX#<YYYY-MM-DD>#<txId>`
- Optional secondary lookup by asset: `GSI1PK = ASSET#<assetId>`, `GSI1SK = TX#<YYYY-MM-DD>#<txId>`

#### Snapshots / derived materialized views
Examples:
- `SK = SNAP#POSITION#<YYYY-MM-DD>#<assetId>`
- `SK = SNAP#PORTFOLIO#<YYYY-MM-DD>`
- `SK = SNAP#PERFORMANCE#<YYYY-MM-DD>`

#### Recommendation runs
- `SK = RECO#RUN#<runTs>#<runId>`
- Items/findings as children:
  - `SK = RECO#ITEM#<runId>#<itemId>`
  - `SK = RECO#FINDING#<runId>#<findingId>`

---

## Access patterns to design for (MVP)

**Auth**
- Get user account by username (bootstrap): either a dedicated `GSI1PK = USERNAME#<username>` index mapping, or store the single user’s ID in config
- Validate session by session ID (recommended: GSI1 session lookup)

**Ledger**
- List transactions by date range (primary key query on `PK=USER#...`, `SK begins_with TX#` and between dates)
- List transactions for an asset by date range (GSI1 on `ASSET#...`)

**Dashboard reads**
- Get “current holdings” materialized items by portfolio
- Get latest snapshots by date

**Recommendations**
- List recent runs (query `SK begins_with RECO#RUN#`)
- Load run details + items + findings (batch-get by keys or query by `SK begins_with RECO#...#<runId>`)

---

## Notes on constraints and integrity
- DynamoDB does not enforce foreign keys; integrity is application-enforced.
- Prefer writing canonical facts first (transactions/valuations) and rebuilding derived snapshots deterministically.
- For financial values, persist as **decimal-as-string** or **scaled integers** to avoid floating-point drift.

