# RupayKg CTO Run 28 — non-owner verification guard prototype

**Date:** 2026-11-04  
**Repository:** `vishaltradewinds/rupaykg`  
**Prototype PR:** [#263](https://github.com/vishaltradewinds/rupaykg/pull/263)  
**Stack:** PR #263 → PR #252 → PR #247  
**Temporary CI PR:** #264 — closed unmerged after exact-head CI evidence capture

## Exact code and CI state

- Latest prototype head: `1ce986d3e5ceab339a77fd1d64d4911b0fbabad4`.
- PR #263 remains OPEN / DRAFT / UNMERGED, stacked on PR #252.
- Exact-head CI #5407 (`41804235750`) completed SUCCESS across dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests including the non-owner FORCE RLS prototype, production-container build and cleanup.
- Earlier prototype head `178e7c77bb5c848fdef27281acdf6a404894d0d4` also passed exact-head CI #5402.
- Temporary validation PR #264 was closed UNMERGED after CI #5407 passed.

## Findings and design refinements

1. **Column UPDATE privilege alone was insufficient.** Initial disposable tests showed that SELECT visibility does not imply a row is available to a locking SELECT under FORCE RLS. PostgreSQL requires an applicable UPDATE policy for the SELECT ... FOR SHARE path used by the guard.
2. **Exact-row UPDATE policies solve the lock visibility requirement without a broad mutation grant.** The guard role receives only column-level UPDATE(id) on the rows it locks. Each UPDATE policy pins USING and WITH CHECK to the exact transaction-local row id. The role can lock the selected row; attempts to change its identifier are filtered or rejected by RLS. No other column UPDATE or DELETE grant is given.
3. **The API identity must be a real login.** A prior test used SET ROLE from a superuser session and was not a valid test of the API role's authority. The fixture now creates a separate password-authenticated LOGIN API role and a NOLOGIN guard role. The actual API login cannot SET ROLE to guard.
4. **Custom GUCs are not credentials.** The API login deliberately sets spoofed guard GUC values and still sees zero evidence rows because RLS policies are targeted only to the inaccessible guard role. The SECURITY DEFINER function overwrites the context for its checks and restores caller values on both success and rejection.
5. **Definer hardening.** The function is owned by the non-owner guard role, has SECURITY DEFINER and row_security=on, and uses a fixed search_path with pg_catalog first and pg_temp last.

## Disposable PostgreSQL evidence

The isolated-schema prototype forces RLS on evidence, activities, identities, organization memberships, roles and organization geography scopes. It verifies:

- Guard role is NOLOGIN, NOSUPERUSER and NOBYPASSRLS; API role is a distinct password-authenticated non-owner login.
- API has no EXECUTE privilege on the trigger function and cannot SET ROLE to the guard role.
- API-supplied GUCs do not reveal source evidence; trigger GUC state is restored after successful and failed decisions.
- Guard can SELECT and lock only the exact evidence, activity, identity, membership and role rows required by the decision.
- Exact-row UPDATE RLS policies permit FOR SHARE while preventing changes to the locked evidence identifier.
- An authorised same-organization verification succeeds through the trigger even though the API has no direct source-table read permission beyond the intentionally RLS-filtered evidence probe.
- Cross-organization evidence, self-verification, out-of-scope geography and suspended identity are denied.
- Concurrent role permission revocation, membership deactivation and identity suspension block on the corresponding row locks and deny the verification after the revocation commits.
- API UPDATE/DELETE on verification rows are denied; owner-side UPDATE is rejected by the immutable trigger.

Local checks: workspace typecheck PASS, API build PASS, diff check PASS. The PostgreSQL integration is skipped locally because no local DATABASE_URL/Docker engine is available; exact-head CI ran it against disposable PostgreSQL.

## What this does NOT prove

- This is an isolated-schema privilege prototype, not the recovered production migration-096 schema or production trigger composition.
- It does not prove Neon managed-role provisioning / CREATEROLE limitations, actual production grants or FORCE RLS policy visibility.
- The fixture geography helper has explicit configured scope for positive/negative tests; production's no-verified-scope permissive behavior remains a separate fail-closed blocker.
- Geography-scope mutation races, evidence/activity reassignment races, lock-order/deadlock analysis across all platform-admin paths, timeout/retry semantics, DELETE/TRUNCATE/tamper-owner controls and independent DBA/security review remain open.
- The test fixture does not implement production guard-role creation, production RLS policies, or a production migration.

## Next execution gates

1. Rehearse the candidate guard against a disposable copy of the recovered migration-096 schema and exact historical trigger/function composition.
2. Validate the design under actual Neon-like non-owner role constraints without touching production.
3. Add geography-scope revocation and evidence/activity reassignment races; review lock ordering, timeouts and bounded retry behavior.
4. Complete role/ACL/function-owner/search_path/trigger/policy audit and DELETE/TRUNCATE/tamper tests under a non-owner runtime.
5. Reconcile the 67-table tenant RLS/geography matrix and the production runtime/migrator separation.
6. Obtain independent DBA/security review before any production decision.

## Release posture

Production Neon remains READ-ONLY / HOLD. No production or staging SQL writes, migrations, grants, role/ownership changes, RLS activation, deployment, merge, worker activation or certification occurred. PR #247, #252, #263 and #244 remain draft/unmerged. SITE-JBP-01 Kathonda remains PRE-VALIDATION. Production certification and TRL 9 are NOT ACHIEVED.
