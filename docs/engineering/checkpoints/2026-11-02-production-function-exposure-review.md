# Production PostgreSQL function exposure review — 2026-11-02

Status: read-only catalog/source review. No production privilege or schema changes.

## Inventory reconciliation

Production database `rupaykg`, project `steep-mud-79906940`, primary branch `br-restless-base-b44cip2h`.

- 78 public-schema functions owned by `rupaykg`.
- All 78 currently have PUBLIC EXECUTE.
- 67 distinct application-owned functions are referenced by the 70 non-internal public triggers.
- 11 application-owned functions are not trigger functions and are directly callable by a database role with the relevant table privileges.
- 37 additional public-schema functions are owned by `cloud_admin` and include extension-provided functionality; do not combine these with the 78 application-owned functions when planning application privilege changes.
- All 78 application-owned functions are SECURITY INVOKER (none SECURITY DEFINER).
- `proconfig` is NULL for the inventoried application functions; no function-level pinned search_path was observed.

## First-pass classification of the 11 non-trigger functions

### Mutating routines — highest review priority

1. `allocate_environmental_attribute_claim(...)`
   - Inserts an ACTIVE environmental-attribute claim.
   - Calls `assert_environmental_attribute_available` to lock/check the basis key.
   - Function body has no explicit actor, verified membership, organization permission or signed tenant-context check.
   - Review the activity/organization/evidence/verification binding and table-level constraints/triggers before permitting any runtime role to execute it.

2. `allocate_epr_credit(p_credit_id,p_obligation_id,p_quantity)`
   - Locks an EPR credit and obligation, checks status/scheme/capacity, inserts an allocation and updates fulfilled quantity.
   - Function body has no explicit actor, organization permission or signed tenant-context check.
   - It does not itself prove that the credit and obligation belong to the caller's active organization. Treat as a cross-tenant mutation risk until table constraints, grants and all call paths prove otherwise.

3. `release_epr_credit_allocation(p_allocation_id)`
   - Locks an allocation, marks it RELEASED and decrements the linked obligation's fulfilled quantity.
   - Function body has no explicit actor, organization permission or signed tenant-context check.
   - Treat as a cross-tenant mutation risk until the runtime grant boundary and caller checks are proven.

All three currently have PUBLIC EXECUTE. They are SECURITY INVOKER, so PUBLIC EXECUTE alone does not grant table DML privileges; nevertheless the current production login is privileged and a future runtime role must not inherit broad table access. Do not apply blanket REVOKE or GRANT changes until application call sites, trigger dependencies, ownership, and least-privilege runtime requirements are mapped.

### Read-only authorization and helper routines

- `can_assess_epr(identity,organization)`, `can_manage_field_device(identity,organization)`, and `can_write_esg(identity,organization)` scope membership checks to the supplied organization.
- `has_verification_permission(identity)` and `identity_has_permission(identity,permission,roles)` search across all verified memberships without an organization parameter. They must not be treated as tenant-scoped authorization proofs where the calling route needs one active organization.
- `organization_has_geography_scope(organization,geography)` returns TRUE when the organization has no VERIFIED geography-scope rows. This is fail-open behavior for an unconfigured scope and must be reconciled against the intended national/pan-India policy. Do not silently change it: define the approved default (deny, explicit national scope, or governed global scope) and add negative tests first.
- `assert_environmental_attribute_available(basis,claim_type)` validates a basis key, takes an advisory transaction lock and checks for an existing ACTIVE VALUE_CLAIM; it is a helper, not an authorization boundary.
- `rupaykg_default_role_permissions(role_name)` is an immutable role-permission catalogue helper.

## Trigger-function mapping

- 70 trigger instances reference 67 distinct application-owned trigger functions.
- All inventoried application-owned trigger functions are SECURITY INVOKER and have no function-level pinned search_path.
- Trigger invocations and their table-level effects must be mapped separately from direct SQL-call exposure. Do not assume that a function being trigger-only makes the surrounding trigger path safe under a future restricted runtime role.
- Next audit: for each trigger, record table/event, function body, owner, caller privileges, referenced tables, cross-tenant lookups, SECURITY INVOKER behavior, search_path resolution and RLS behavior under the intended runtime role.

## Required remediation gates

1. Build an exact application call-site inventory for all 11 non-trigger routines and each trigger function.
2. Determine which functions require direct runtime execution, which should be trigger-only, and which should be inaccessible to PUBLIC.
3. For the three mutating routines, require organization binding, verified actor/permission and signed tenant context inside the same transaction, or replace with narrowly scoped approved database APIs.
4. Review `identity_has_permission` and `has_verification_permission` call sites for organization-scope leakage.
5. Resolve the geography no-scope TRUE default with a documented statutory/geographic authority model and explicit tests.
6. Pin safe search_path on functions where name resolution can be influenced by caller-controlled schemas; qualify sensitive object references and review extension objects.
7. Rehearse all privilege changes on a disposable production-derived branch using the exact proposed runtime role; test direct function calls, trigger paths, two-tenant access, missing/forged context and cross-tenant writes.
8. Obtain independent DBA/security approval before any production privilege changes.

## Release boundary

Production remains READ-ONLY / HOLD. No function privileges, roles, grants, schema, data, migration ledger, deployment, worker state, external registry state or certification were changed. This is a first-pass inventory and static function-body review, not a complete application call-graph or penetration test.
