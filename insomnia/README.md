# Insomnia — Badgers Investments API

API collections and environments live here, colocated with the repo (Insomnia **v5.1** YAML).

Import into [Insomnia](https://insomnia.rest/) to exercise authenticated portfolio, assets, ledger, and holdings endpoints.

## Import

1. **Application → Preferences → Data → Import data** (or **Create → Import from File**).
2. Import **`badgers-api.yaml`** (collection + requests + embedded **Local (Badgers API)** environment).
3. Optionally import **`local-dev.yaml`** as a separate global environment file if you keep environments outside the collection (same variable keys as below).

## Before you send requests

1. Run the API locally: `pnpm --filter api dev` (default `http://localhost:3000`).
2. Ensure a user exists in DynamoDB with the same username/password as your Insomnia environment (e.g. `pnpm bootstrap:user` with matching `BOOTSTRAP_USERNAME` / `BOOTSTRAP_PASSWORD` in root `.env`).
3. Select the **Local (Badgers API)** / **Base** environment in the Insomnia environment dropdown.
4. **Login** first (`POST /auth/login`). Insomnia stores the session cookie for later requests when **Send cookies** / **Store cookies** are enabled (set on these requests).

## Suggested order

1. `Auth / Login`
2. `Auth / Session` (optional sanity check)
3. `Portfolio / Get` (creates default portfolio if missing)
4. `Portfolio / Patch` (optional)
5. `Assets / Create` — after-response script saves `asset_id` into the active environment when the response is `201`.
6. `Transactions / Create (BUY)` — saves `transaction_id` when `201`.
7. `Transactions / List`, `Holdings / Get`, then PATCH/DELETE transaction as needed.

If `asset_id` or `transaction_id` are empty, run **Create** requests first or paste IDs from responses into **Manage Environments**.

## After-response “tests”

Scripts use `insomnia.test` / `insomnia.expect` (Chai-style). They are stored under **`scripts.afterResponse`** in the YAML and run when you **Send** a request in the **Debug** tab.

## Variables (local example)

| Variable | Purpose |
|----------|---------|
| `base_url` | API origin (no trailing slash), e.g. `http://localhost:3000` |
| `username` | Must match bootstrapped user (example file uses fake values) |
| `password` | Fake example only — align with your local `.env` |
| `asset_id` | Filled by **Assets / Create** script or manually |
| `transaction_id` | Filled by **Transactions / Create (BUY)** script or manually |

## CORS

Insomnia desktop sends requests like a non-browser client; CORS does not apply. If you ever proxy through a browser extension, set `CORS_ORIGIN` on the API to match.
