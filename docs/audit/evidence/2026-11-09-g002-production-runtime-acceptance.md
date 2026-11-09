# RupayKg — G-002 Production Runtime Acceptance Evidence — 2026-11-09

## Scope

This evidence record covers the controlled production runtime acceptance following G-002 tenant-isolation activation and the subsequent PostgreSQL SSL-warning hardening.

## Canonical source

- Repository: `vishaltradewinds/rupaykg`
- Branch: `main`
- Verified head: `19c40659594760711e1b3584706b3e1586a903e4`

## Deployment evidence

- Render service: `rupaykg`
- Production deployment: `dep-dbopsjoae00c73a01ma0`
- Trigger: new commit
- Deployment status: LIVE
- Deployment commit: `19c40659594760711e1b3584706b3e1586a903e4`

## Runtime security acceptance

The deployed runtime was verified against the controlled G-002 contract:

- application runtime role: `rupaykg_runtime_login`
- SUPERUSER: false
- BYPASSRLS: false
- protected tenant tables: 17
- protected tables with RLS enabled: 17
- runtime role owns protected tables: 0
- governed SECURITY DEFINER boundary: PASS
- production health endpoint: HTTP 200
- root endpoint: HTTP 200

## PostgreSQL SSL hardening

PR #335 corrected the dedicated runtime preflight connection. Production verification then identified that the authoritative application pool still passed `DATABASE_URL` directly.

PR #336 applied the same explicit TLS policy to the authoritative application pool:

- parse `DATABASE_URL`
- remove URL `sslmode`
- retain explicit `DATABASE_SSL` / certificate verification behavior
- do not weaken certificate verification

The resulting merge commit `19c40659594760711e1b3584706b3e1586a903e4` was deployed to production.

Verified application logs for the deployment window contained no `sslmode`, SSL warning, preflight warning, or related warning.

## Decision

**G-002 technical production runtime gate: PASS.**

This evidence establishes engineering/runtime acceptance only. It does not establish statutory certification, external Guardian/Hedera acceptance, field validation, or TRL 9.

## Remaining Shakti blockers

1. Authoritative production Guardian MRV verification.
2. Hedera operator credentials and live consensus confirmation.
3. Real authenticated organization/activity/evidence/verification acceptance workflow.
4. Persisted provenance followed by Mirror Node verification.
5. Production monitoring/alerting.
6. Backup/restore test evidence.
7. Rollback evidence.
8. Remaining statutory/regulatory/external approvals and field acceptance.
