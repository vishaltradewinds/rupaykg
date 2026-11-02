# RupayKg — PostgreSQL function privilege inventory and revocation boundary

Date: 2026-11-03
Source: read-only catalog audit of Neon production project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`; static application source review at candidate commit `72b5dab3423ae75d72bcc25c68087ed36f495d91`.
Status: engineering inventory; no production writes, grants, revocations or migrations.

## 1. Observed production inventory

- 115 public-schema functions/procedures total.
- 37 extension-owned functions (not in the application-owned remediation scope).
- 78 application-owned functions.
- 67 application-owned functions return PostgreSQL `trigger` and are attached to one or more non-internal triggers.
- 11 application-owned functions are ordinary callable functions.
- All 78 application-owned functions currently have PUBLIC EXECUTE and no pinned search_path.
- All application-owned functions are owned by the existing elevated `rupaykg` role.
- The only role among the intended runtime/owner/security roles present in the production catalog query was `rupaykg`; `rupaykg_app_runtime`, `rupaykg_auth_runtime`, `rupaykg_app_owner`, `rupaykg_auth_owner`, `rupaykg_worker_runtime`, and `rupaykg_security_definer` were absent at audit time.
- This confirms the production environment is not provisioned for the candidate runtime/owner architecture. Do not apply migrations that assume those roles exist.

## 2. Trigger-returning functions

All 67 application-owned trigger-returning functions are bound to one or more non-internal triggers. These functions are not direct application APIs. Candidate migration `20261114_revoke_public_trigger_function_execute.sql` revokes only PUBLIC EXECUTE from this set, excluding extension-owned routines. It deliberately does not revoke any ordinary callable function.

PostgreSQL executes trigger functions through the trigger binding when an authorized table DML statement fires the trigger; callers do not invoke the trigger function by a direct SQL function call. The integration test `apps/src/trigger-function-execute.postgres.integration.test.ts` asserts that every application trigger function remains attached and no such function retains PUBLIC EXECUTE after the migration chain.

## 3. Ordinary callable functions — exact signatures and observed dependencies

| Function signature | Application source call sites observed | Database function dependency | Next grant decision |
|---|---|---|---|
| `allocate_environmental_attribute_claim(uuid,uuid,text,text,text,numeric,text,text,text,uuid,uuid,uuid,jsonb)` | No direct TypeScript call found in reviewed app route/source set | Called by trigger `record_epr_credit_value_claim()` | Do not revoke until caller execution identity and claim API path are proven |
| `allocate_epr_credit(uuid,uuid,numeric)` | No direct TypeScript call found | No dependency found in other application-owned public function bodies | Candidate unused; verify SQL scripts/operational jobs before revocation |
| `assert_environmental_attribute_available(text,text)` | No direct TypeScript call found | Called by `allocate_environmental_attribute_claim(...)` | Preserve until outer allocation function execution identity is established |
| `can_assess_epr(uuid,uuid)` | `apps/src/value-routes.ts` | None found | Grant only to app runtime after role exists and route moves to tenant transaction boundary |
| `can_manage_field_device(uuid,uuid)` | `apps/src/sync-routes.ts` | None found | Grant only to app runtime after role exists and route moves to tenant transaction boundary |
| `can_write_esg(uuid,uuid)` | `apps/src/value-routes.ts` | None found | Grant only to app runtime after role exists and route moves to tenant transaction boundary |
| `has_verification_permission(uuid)` | No direct TypeScript call found | No dependency found in other application-owned public function bodies | Candidate unused/legacy; verify migration or operations use before revocation |
| `identity_has_permission(uuid,text,text[])` | No direct TypeScript call found | Called by `enforce_registry_event_permission()` and `enforce_settlement_event_permission()` triggers | Preserve for trigger execution until invoker/definer and DML grant model is finalized |
| `organization_has_geography_scope(uuid,uuid)` | `apps/src/auth.ts`, `epr-return-routes.ts`, `evidence-vault-routes.ts`, `value-routes.ts`, `sync-routes.ts`, `cpcb-swm-routes.ts`, `statutory-routes.ts`, `mrv-routes.ts` | Called by `enforce_resource_flow_geography_scope()`, `enforce_activity_geography_scope()`, and `enforce_epr_external_registration_evidence()` triggers | Must remain executable by the eventual app runtime and any trigger execution role that needs it |
| `release_epr_credit_allocation(uuid)` | No direct TypeScript call found | No dependency found in other application-owned public function bodies | Candidate unused; verify SQL scripts/operational jobs before revocation |
| `rupaykg_default_role_permissions(text)` | No direct TypeScript call found | Called by `apply_rupaykg_role_defaults()` trigger | Preserve for trigger execution; role writes should be through restricted auth/onboarding routines |

The source review covers the app TypeScript files fetched from the candidate repository tree. Absence of a TypeScript call is not proof of no use: migration scripts, operational SQL, direct database clients, scheduled jobs and external integrations must also be checked.

## 4. Revocation plan — safe order

1. Revoke PUBLIC EXECUTE from the 67 trigger-returning application functions only (candidate migration 20261114).
2. Keep PUBLIC EXECUTE on the 11 ordinary callable functions unchanged for now.
3. Provision dedicated roles in a controlled DBA ceremony; do not create or rotate production login roles from an unreviewed application migration.
4. Move every route using the callable helpers to one transaction-bound tenant context, and establish exact runtime-role grants.
5. Revoke PUBLIC EXECUTE per callable signature only after tests prove every legitimate caller role has explicit EXECUTE and unauthorized roles do not.
6. Re-run the full PostgreSQL acceptance suite with the actual dedicated app/auth/worker runtime role credentials, not the migration owner.
7. Verify both successful business operations and denied direct calls under each runtime role.

## 5. Existing source-code contract and gaps

- `apps/src/server.ts` expects production `DATABASE_URL` to authenticate as `rupaykg_app_runtime` and `AUTH_DATABASE_URL` as `rupaykg_auth_runtime`; it fails closed on elevated attributes, role inheritance, owner membership, direct auth-table access and incorrect auth function grants.
- `apps/src/mrv-worker-server.ts` expects a dedicated worker role, verifies NOBYPASSRLS/no owner membership, required table grants and FORCE RLS on worker tables.
- `apps/src/rls-request-transaction.ts` creates a transaction-local signed tenant context, but explicitly documents that direct pool queries must not be replaced until all tenant routes use this boundary and the production app role is NOBYPASSRLS.
- Static review still finds several routes using direct pool queries and helper checks outside the signed transaction wrapper. RLS must not be activated globally until that route-level reconciliation is complete.
- Production role audit shows none of the expected runtime/owner/security roles provisioned at audit time. Production runtime readiness is therefore FAIL-CLOSED.

## 6. Release gates

- PR #213 and #216 remain draft/unmerged.
- Candidate migrations 20261111–20261114 are not deployed to production.
- Production RLS is 0/67 tables; current `rupaykg` login has BYPASSRLS and elevated role attributes.
- Independent security/DBA review is still outstanding.
- No production DDL, role, grant, revocation, secret, worker, feature-flag or deployment action was taken.
- TRL 9 is not established.
