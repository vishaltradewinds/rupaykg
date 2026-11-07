# G-002 Tenant RLS Rehearsal — Corrected Evidence — 2026-11-07

## Finding

The initial NOBYPASSRLS rehearsal used a probe role that was not the role targeted by the tenant policies. The zero-row result was therefore a role-selection/test-harness error, not evidence of a broken RLS predicate.

## Authoritative policy target

For public.activities, the tenant policies are explicitly scoped to:

rupaykg_app_runtime

The role was independently inspected and confirmed:
- rolsuper = false
- rolcreaterole = false
- rolcreatedb = false
- rolreplication = false
- rolbypassrls = false
- rolcanlogin = true

## Corrected A/B rehearsal

Using the intended policy target role in the Neon rehearsal branch:
- Org A context: 1 visible Org-A row, 0 Org-B rows.
- Org B context: 1 visible Org-B row, 0 Org-A rows.
- INSERT under Org A: succeeded, then rolled back.
- UPDATE under Org A: succeeded, then rolled back.
- DELETE against Org B from Org A context: affected 0 rows.
- DELETE under Org B: succeeded, then rolled back.

## Determination

**Tenant RLS A/B isolation rehearsal: PASS for rupaykg_app_runtime.**

This closes the specific rehearsal failure recorded in issue #325.

## Remaining G-002 requirement

This rehearsal does not prove the deployed production runtime identity. Production remains unchanged. The next gate is to independently establish that the deployed service connects as the intended NOBYPASSRLS policy-target role and then run production-safe runtime evidence.

Issue #325 is closed as resolved test-harness error.
