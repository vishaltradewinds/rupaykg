# RupayKg Production Tenant-Isolation Activation Runbook

Status: PREPARED — NOT EXECUTED
Gate: G-002 production activation
Canonical repository: vishaltradewinds/rupaykg
Target branch: main
Prepared: 2026-11-09

## Purpose

This runbook defines the controlled production activation sequence for Shakti tenant isolation. It is intentionally separate from engineering/CI and staging acceptance.

Production must remain fail-closed until every preflight passes.

## Preconditions — all mandatory

1. Confirm the target production Neon project/branch/database is the authoritative live database.
2. Confirm production application traffic can be stopped or held during the DDL activation window.
3. Confirm migrations 097, 098 and 099 are present and schema compatibility preflight passes.
4. Confirm the dedicated production DDL role owns all 17 protected tables.
5. Confirm the dedicated production application runtime login is:
   - LOGIN
   - NOSUPERUSER
   - NOBYPASSRLS
   - not owner of any protected table
   - member of the governed runtime privilege role only.
6. Confirm the three governed SECURITY DEFINER functions have hardened search_path:
   - app.set_request_context(uuid,uuid)
   - app.is_verified_org_member(uuid)
   - app.authenticate_bearer_session(text)
7. Confirm PUBLIC EXECUTE is revoked from all three functions.
8. Confirm the runtime preflight passes against the exact production runtime credential.
9. Confirm the cross-tenant negative acceptance is ready to execute after activation.
10. Confirm a tested rollback/abort decision owner and evidence capture location.

## Execution order

### Gate A — production read-only preflight

Run:
- ops/tenant-isolation/VERIFY_MIGRATION_SCHEMA_COMPATIBILITY.sql
- ops/tenant-isolation/VERIFY_SECURITY_DEFINER_BOUNDARIES.sql
- the runtime DB preflight from apps/src/runtime-db-preflight.ts

Do not continue on any failure.

### Gate B — production DDL ownership/runtime separation

Using the controlled DDL role, verify:
- all 17 protected tables are owned by the DDL role;
- application runtime is not a table owner;
- application runtime is not SUPERUSER/BYPASSRLS.

Do not use the privileged database owner as the application runtime credential.

### Gate C — controlled RLS activation

Execute:
- ops/tenant-isolation/ACTIVATE_RLS.sql

The script must run under the dedicated DDL role, not the application runtime role.

Capture the resulting 17-table RLS status as deployment evidence.

### Gate D — runtime negative acceptance

Immediately execute the production equivalent of the rehearsed acceptance:
- authenticated tenant A can read only tenant A;
- tenant A cannot read tenant B;
- tenant A cannot update tenant B;
- tenant A cannot delete tenant B;
- no tenant context yields zero protected tenant rows;
- governed SECURITY DEFINER functions remain callable by runtime;
- PUBLIC cannot execute governed SECURITY DEFINER functions.

Use disposable/synthetic acceptance fixtures only. Do not create real production business data merely for testing.

### Gate E — application startup/HTTP acceptance

Start/redeploy the production application using only the dedicated non-BYPASSRLS runtime credential.

Required evidence:
- runtime DB preflight PASS;
- application startup PASS;
- health endpoint PASS;
- safe non-mutating status endpoint PASS;
- authenticated tenant read PASS;
- cross-tenant negative test PASS.

### Gate F — release decision

Production activation is considered complete only when all evidence is captured and reviewed.

## Abort conditions

Abort immediately if:
- schema compatibility fails;
- any protected table is missing;
- DDL ownership is incomplete;
- runtime is SUPERUSER or BYPASSRLS;
- runtime owns a protected table;
- any governed SECURITY DEFINER function is missing, unhardened, or publicly executable;
- any RLS policy is missing;
- any cross-tenant negative test fails;
- application startup does not pass the runtime DB preflight.

## Rollback policy

Preferred rollback is **abort before RLS activation**.

After RLS activation, the default response to an application failure is NOT to disable RLS. Keep RLS enabled and stop/hold application traffic while correcting the runtime/application defect.

Disabling RLS in production is an emergency controlled operation only, requiring:
- application traffic stopped;
- incident record;
- explicit DDL authority;
- evidence capture;
- revalidation before reopening traffic.

Never use the application runtime role for emergency DDL.

## Security rules

- Never place a database password in Git.
- Never print a DATABASE_URL in logs or evidence.
- Never use the privileged owner credential as the application runtime credential.
- Never bypass RLS to make an application test pass.
- Never claim regulatory certification, field validation, or TRL 9 from this technical gate alone.

## Evidence package

Capture:
1. migration/schema compatibility output;
2. SECURITY DEFINER boundary output;
3. runtime role identity/preflight output;
4. DDL ownership output;
5. 17-table RLS activation output;
6. cross-tenant negative acceptance output;
7. application startup/health evidence;
8. deployment commit SHA;
9. production database branch identifier;
10. operator/time window and explicit activation decision.

## Current state

This runbook is prepared from the completed G-002 engineering, CI, isolated Neon rehearsal, and deployed Render runtime acceptance.

It has NOT authorized or executed production activation.
