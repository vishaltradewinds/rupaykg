# Immutable checkpoint — FK ownership and privilege review — 2026-10-31

## Repository
- Repo: `vishaltradewinds/rupaykg`
- Branch: `shakti/atomic-inbox-claim-2026-10-31`
- Starting HEAD: `330eac0afa5ff977b6755debbbcf1154b7f75ca8`.
- Starting exact-head CI: run #3939 / ID `41215831754`, COMPLETED / SUCCESS.
- New review document commit: `a478ccc4ba9ea5cb48f5accf6d0b6c3a48d11942`.
- New document: `docs/security/PRODUCTION_FK_OWNERSHIP_AND_PRIVILEGE_REVIEW_2026-10-31.md`.
- This checkpoint is an immutable handoff; latest resume pointer must be updated after it.

## Work completed
1. Queried authoritative Neon production catalog read-only.
2. Confirmed 181 FK constraints in production.
3. Confirmed 109 trigger rows across 33 tables invoking 67 distinct trigger functions.
4. Inspected representative ownership paths across activities, BWG reports, carbon calculations/projects, chain-of-custody, SWM workspaces/status history, credentials, environmental claims, EPR credits/allocations/transfers and obligations.
5. Inspected production role catalog: `cloud_admin` LOGIN/SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION; `neon_service` LOGIN/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION; `rupaykg` LOGIN/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION; `neon_superuser` NOLOGIN/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION. `rupaykg` is a member of `neon_superuser`.
6. First-pass function inventory did not show application SECURITY DEFINER functions in the displayed rows, but exact full inventory, bodies, ACL and search_path proof remains outstanding.
7. Relation ACL/default-privilege catalog query was blocked by inspection safety checks; no claims of safe ACL/sequence/function grants are made.
8. Added `docs/security/PRODUCTION_FK_OWNERSHIP_AND_PRIVILEGE_REVIEW_2026-10-31.md`.

## Security decisions
- Existing trigger functions enforce important lifecycle/integrity controls but do not substitute for RLS.
- Do not use any current broad role as runtime API/worker identity.
- Do not implement blanket tenant GUC policies.
- Future RLS must be table-specific and support FK-child, identity-private, bilateral, device/offline, governance/control-plane, global reference and append-only provenance semantics.
- Require a trusted cryptographic capability boundary or equivalent non-forgeable context before relying on tenant context in RLS.
- ACL, default privilege, sequence and function execute review remains a blocking gap.

## Production safety
- Neon production unchanged. No DDL/DML, migration, role/grant/policy/credential change, branch operation, deployment, worker activation or certification action.
- 67 public tables; 0 RLS-enabled; 0 public policies; 92 migration rows; max version `20261021`.
- Tenant isolation NOT ESTABLISHED. Production HOLD. Worker OFF. Scheduler OFF. Certification OFF. TRL 9 NOT ESTABLISHED.

## Next actions
1. Update latest resume pointer.
2. Check exact-head CI for the new docs/checkpoint/pointer commits.
3. Complete ACL/sequence/default privilege/function execute inventory with narrow safe read-only queries.
4. Complete exhaustive route-handler → SQL callsite → table → operation → principal → context map.
5. Design and rehearse least-privilege roles and table-specific RLS on a disposable production-derived Neon branch.
6. Independent security review and explicit approval before any production change.
