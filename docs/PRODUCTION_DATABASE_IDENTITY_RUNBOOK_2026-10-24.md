# Production Database Identity Verification Runbook — 2026-10-24

## AIM and Shakti gate

Prove which PostgreSQL database and role the live RupayKg service uses before changing roles, applying migrations, or approving release. This procedure is read-only until a separately approved change plan exists.

**Current gate:** Production certification HOLD. Render service `rupaykg` tracks `main` with auto-deploy enabled. Do not merge PR #44 or trigger a deployment to perform this investigation.

## 1. Verify Render configuration without disclosing secrets

An authorized operator opens the Render dashboard for service `rupaykg` and reviews Environment. Do not copy, paste, screenshot, log, or send connection-string passwords/tokens to chat, tickets, shell history, or CI logs.

Confirm that these variable names exist:
- `DATABASE_URL`
- `MIGRATION_DATABASE_URL`
- `DATABASE_SSL`
- `DATABASE_CA_CERT` (unless the approved connection mode explicitly makes a CA certificate unnecessary)
- `RUPAYKG_AUTH_MODE`
- `RUPAYKG_ALLOWED_ORIGINS`

For each database URL, record locally only the non-secret metadata: provider/project, branch, database name, hostname, username/role, and TLS mode. Never record password, full URL, query tokens, or certificate contents.

Check that runtime and migration URLs:
- target the same exact provider endpoint, branch, and database;
- use distinct database roles;
- use the TLS mode required by the provider and the production configuration;
- do not silently point at a stale/suspended database or a staging branch.

A hostname/database-name match alone is insufficient to prove branch identity. Confirm provider project and branch from the provider console or connection details.

If either URL is absent, roles are identical, endpoint mapping is ambiguous, or TLS cannot be proven, stop. Do not change variables or restart/deploy the service.

## 2. Verify connection identity through a trusted operator session

Use an approved secret manager or trusted workstation to inject the already-authorized runtime connection string into the existing read-only migration-state verifier. Do not place secrets in command arguments, shell history, screenshots, or logs.

Run:
```powershell
npm run verify:migration-state -w @rupaykg/api
```

The verifier is read-only and checks repository migration inventory against `schema_migrations`. Preserve its sanitized report, including provider/branch/database identity if available, migration counts, missing/mismatched/unexpected versions, and exit status. Do not attach raw connection strings or environment dumps to the report.

If the verifier's output does not conclusively identify the server/branch, the provider-console mapping in Step 1 remains required. Do not infer the target from the database name or migration count alone.

## 3. Read-only database checks

After endpoint identity is independently confirmed, run read-only SQL using an authorized connection. These statements reveal metadata, not credentials:

```sql
SELECT current_database() AS database_name,
       current_user AS connected_role,
       inet_server_addr()::text AS server_address,
       inet_server_port() AS server_port,
       version() AS postgres_version;

SELECT version, filename
FROM public.schema_migrations
ORDER BY version;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'audit_events',
    'platform_audit_chain_head',
    'platform_audit_chain_anchor'
  )
ORDER BY table_name;

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'audit_events'
ORDER BY trigger_name, event_manipulation;

SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
       rolreplication, rolbypassrls
FROM pg_roles
WHERE rolname = current_user;
```

Do not run role/ownership/grant changes as part of this diagnostic batch. Export only sanitized query results. Record provider project and branch separately because SQL server metadata alone may not uniquely identify a cloud branch.

## 4. Recovery and migration prerequisites

Before any production migration or role transition:
1. Prove a backup exists and restore it into an isolated target.
2. Record tested recovery point objective (RPO) and recovery time objective (RTO).
3. Reconcile every repository migration with the identified database's migration ledger.
4. Review role ownership, schema privileges, table/sequence/function grants, and audit-chain trigger ownership.
5. Exercise application workflows using the proposed non-owner runtime role on an isolated database.
6. Obtain an approved change window and rollback plan.

Do not apply migration 088 or the later dated migrations merely to make migration counts match. Confirm dependency order, backup/restore, lock impact, and target identity first.

## 5. Evidence record

Attach to the PR, with secrets removed:
- timestamp and operator;
- confirmed provider/project/branch/database;
- runtime role name and migration role name (names only);
- TLS mode and how it was verified (never certificate/key contents);
- migration-state verifier result;
- audit anchor/head/trigger results;
- role-attribute and privilege review;
- backup and restore evidence;
- unresolved risks and release-gate decision.

**Pass criteria:** Exact service-to-database mapping is proven; separate least-privilege runtime and migration roles are confirmed; TLS and migration state are verified; audit enforcement is present; restore is proven.

**Fail/hold criteria:** Any uncertainty about endpoint/branch/role, missing audit-chain objects, excessive runtime privileges, unverified TLS, or missing restore evidence. Production certification remains HOLD until all criteria pass.
