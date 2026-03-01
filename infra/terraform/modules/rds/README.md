## Module: rds

Creates a single PostgreSQL RDS instance for production (MVP).

### Notes

- Credentials are generated with `random_password` and exposed via a sensitive `database_url` output.
- The production stack stores the `database_url` in Secrets Manager.

