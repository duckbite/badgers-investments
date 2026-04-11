## Module: app-dynamodb-table

Creates a single DynamoDB table for application data using composite keys **`PK` / `SK`** (string), on-demand billing, and by default **GSI1** on **`GSI1PK` / `GSI1SK`** with `ALL` projection — matching the production table so dev and prod stay aligned.

Use **one table per environment** (e.g. dev vs prod). Set `gsi1_enabled = false` only if you intentionally want a minimal table (not prod-parity).

Set **`deletion_protection_enabled = true`** in production so `DeleteTable` is blocked until protection is turned off in Terraform. **`terraform destroy`** on a protected table fails until you set the flag to `false` and apply.

Changing `hash_key_name` / `range_key_name` on an existing table forces replacement (new table).
