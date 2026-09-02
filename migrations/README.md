# Database migrations

Apply migrations in filename order against a fresh PostgreSQL database:

1. `001_core.sql` — authoritative core entities and lifecycle enums.
2. `002_regulatory.sql` — versioned regulatory source catalog.
3. `003_identity_geography_operations.sql` — source-versioned geography, identity credentials, assignments and offline operation intake.
4. `004_security_auth.sql` — organization memberships and opaque identity sessions.
5. `005_carbon_epr_esg.sql` — carbon projects/calculations, EPR and ESG reporting records.
6. `006_registry_settlement_guardrails.sql` — database-level issuance and settlement safety guards.
7. `007_resource_flow_mrv.sql` — resource custody links and MRV observation/verification requirements.

Migration files are intentionally ordered and each numbered migration must have one authoritative owner. Do not reintroduce duplicate numbered migrations containing the same tables or enums.

## Production rule

A migration runner must stop on the first error. Never silently continue after a partial schema application. Run against a controlled migration ledger in deployment infrastructure before accepting application traffic.
