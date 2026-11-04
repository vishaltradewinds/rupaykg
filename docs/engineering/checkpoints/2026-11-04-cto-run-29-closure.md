# RupayKg CTO checkpoint — Run 29 closure

**Date:** 2026-11-04  
**Repository:** `vishaltradewinds/rupaykg`  
**Production:** Neon main, READ-ONLY / HOLD  
**Integration status:** all isolated candidate CI passed; combined trigger/role/context rehearsal remains NOT DONE.

## Exact-head results

| Candidate | Exact head | CI | Result |
|---|---|---:|---|
| PR #272 — canonical verification trigger | `a8ce1c9bbb1d88a88dffe142967fec65d7ad77d9` | #5516 / `41874461093` | SUCCESS, 18/18 |
| PR #284 — signed context + tenant-bound app helpers | `cbd743a8d2e17100cd1607ef19f90bef6a6ccc6d` | #5521 / `41875338287` | SUCCESS, 18/18 |
| PR #284 — prior no-PUBLIC-EXECUTE head | `2b1ebc88237e9274e563b5605295ce925cabd234` | #5518 / `41874715707` | SUCCESS, 18/18 |
| PR #252 — membership/role tenant binding | `2228100e0da0a1dc9321b11e48f6b2fa4ee6ba33` | #5376 / `41796337375` | SUCCESS |
| PR #250 + #251 combined geography rehearsal | `5ccee9b27969db854d6fcee3065e1bcfa0b4b3a9` | #5506 / `41871842788` | SUCCESS; temporary PR #287 closed unmerged |
| PR #268 — separate migrator boundary | `9e642018d821168d7e1f4e972161a334b859784c` | #5406 / `41804150174` | SUCCESS |
| PR #263 — non-owner guard prototype | `d785882c4befc3ecb360e7c73e2005bfdbfe3c13` | #5457 / `41812353414` | SUCCESS |

PR #272 denies verification when no VERIFIED geography root exists and includes a full-schema regression for a PENDING-only root. PR #284 removes PUBLIC EXECUTE from context helpers, grants only the disposable API proof role the context-issuer function, and binds application verifier permission to exact activity organization, membership organization and role organization; both verification write routes pass the resolved organization.

## Remaining critical work

- Combine #252 + #272 + #250/#251 + #284 into one integration branch.
- Use one `rupaykg_verification_guard` NOLOGIN/NOBYPASSRLS owner; eliminate #284's separate `rupaykg_auth_context_owner`.
- Consolidate duplicate `enforce_verification_authorization()` definitions and the trigger into one final SECURITY DEFINER function that preserves #272's tenant/geography/role locking, #284's database-issued bearer context, and immutable decision-time provenance.
- Set `app.request_context` and DB-issued context on the same client and top-level transaction; compare actor/organization claims in the final trigger; prove pool reset and rollback behavior.
- Establish the actual API runtime identity and grant only context-issuer EXECUTE; no PUBLIC grant.
- Rehearse against disposable PostgreSQL with recovered migration-096 columns and legacy triggers; prove idempotency, one trigger, exact grants, lock order and revocation races.
- Reconcile 92 production migration ledger rows against 91 active source files; preserve orphaned 096 as evidence only.
- Complete the 67-table RLS/FORCE RLS matrix, independent DBA/security review, backup/restore/rollback and release-governance gates.

## Production snapshot

Read-only Neon catalog: 67 public base tables, 0 RLS, 0 FORCE RLS, 0 public policies; all 67 owned by `rupaykg`; migration ledger 92 rows/latest `20261021`; `rupaykg` is LOGIN/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION and member of `neon_superuser`. Render live service still auto-deploys on commit while manifest says checks-pass; GitHub main remains unprotected and repository rulesets empty.

No production DDL/DML, migrations, role/grant/ownership changes, RLS, branch operations, secrets/config changes, deployments, merges, worker activation or certification occurred. SITE-JBP-01 remains PRE-VALIDATION; national-platform provisional TRL 3, components at most TRL 4; TRL 9 NOT ACHIEVED.
