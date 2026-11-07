# RupayKg — Disposable Adversarial Runtime Privilege Acceptance
Date: 2026-11-06

## Purpose
Define the next disposable-only acceptance gate for the runtime identity and the 67-table access model.

## Required controls

1. Runtime role is LOGIN but not SUPERUSER, CREATEROLE, CREATEDB, REPLICATION, or BYPASSRLS.
2. Application object ownership is held by a separate NOLOGIN schema-owner identity.
3. Runtime role receives no ownership and no grant-option privileges.
4. Runtime role receives only schema/table/sequence/function privileges required by the access-path inventory.
5. PUBLIC does not silently provide application access.
6. TENANT RLS denies cross-tenant reads and writes.
7. BILATERAL RLS denies access when bilateral scope is disabled and permits only participating organizations when enabled.
8. INHERITED RLS follows the real parent chain: Organization → Activity → Evidence → Verification.
9. SHARED/ROOT objects are separately tested for read-only catalog access versus protected identity/control-plane/migration data.
10. Service mode is explicit and unavailable to ordinary tenant requests.
11. Runtime role cannot create/alter/drop roles, schemas, tables, policies, or migrations.
12. Runtime role cannot modify schema_migrations.
13. Required sequence and function privileges are explicit rather than inherited from PUBLIC.
14. Transaction-local identity/organization/service/bilateral context is cleared on connection reuse.
15. Backup/restore rehearsal remains successful.
16. Full CI passes after the acceptance harness is integrated.

## Acceptance matrix

| Area | Positive test | Negative/adversarial test |
|---|---|---|
| Tenant | own-tenant CRUD | cross-tenant SELECT/INSERT/UPDATE/DELETE |
| Bilateral | both participating sides with scope enabled | scope disabled; unrelated org denied |
| Inherited | activity/evidence/verification follows parent org | cross-org verification mutation denied |
| Identity | active identity + active membership | revoked membership / suspended identity denied |
| Service mode | explicit service identity can perform approved cross-org operation | ordinary tenant cannot self-enable service mode |
| Runtime role | required application DML succeeds | DDL/role/admin operations fail |
| Migration ledger | migration job can manage ledger | runtime role cannot write it |
| Public privileges | explicitly approved catalog access | accidental PUBLIC application access absent |
| Pool hygiene | context works inside transaction | prior tenant context absent after transaction release |

## Release interpretation

Passing this rehearsal proves only disposable engineering readiness for the tested privilege/policy model. It does not authorize production role changes or RLS enablement.

Production remains READ-ONLY/HOLD until all 67 tables have access-path evidence, all 23/8/22/14 policy classifications are reviewed, the production privilege/ownership plan is independently reviewed, rollback/restore evidence is current, and explicit founder approval is obtained for production database changes.

No production mutation is performed by this document.