# CTO checkpoint — signed tenant-context verifier owner hardening

**Date:** 2026-11-02  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `security/db-signed-request-context-verifier-2026-11-01`  
**PR:** #201  
**Production posture:** HOLD — no production changes

## Evidence discovered

The original PR #201 migration was successfully executed on the disposable Neon branch `rupaykg-rls-assurance-lab-20261101` (`br-red-salad-b4oqb4nx`). Catalog inspection proved:

- `app_security.current_request_context_claims()` was `SECURITY DEFINER`.
- Its owner was `rupaykg`, the broad application/database owner role.
- The key table was also owned by `rupaykg`.
- PUBLIC could not execute the function or SELECT the key table.
- The verifier had a pinned `search_path=pg_catalog, app_security`.
- `pgcrypto` was installed in `public`, matching the explicit `public.hmac` reference.

The owner result was not acceptable for the security boundary. A SECURITY DEFINER function must not execute under the broad application/database owner.

## Implemented correction on PR #201

1. The migration now requires a pre-provisioned `rupaykg_security_definer` role.
2. It fails closed unless that role is NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOINHERIT and NREPLICATION.
3. It rejects any outbound membership of the security-definer role in another role.
4. It creates `app_security` with the restricted role as owner and uses `SET LOCAL ROLE` so the key table and verifier are owned by that role.
5. CI provisions the restricted role only in its disposable PostgreSQL service and grants the database CREATE privilege required for schema creation.
6. PostgreSQL integration tests assert function/table ownership, role flags, absence of PUBLIC execution/key-read privileges, fixed search_path, no outbound role membership, valid signature acceptance, and missing/forged/expired/unknown-key denial.
7. Migration documentation records the DBA prerequisite and prohibits runtime/worker/auth principals from membership in the security-definer owner role.

## Important deployment prerequisite

A DBA must provision the NOLOGIN role and grant membership only to the dedicated migration principal before the migration is applied. This PR does not create production roles, alter production grants, provision secrets, or apply the migration to production. The production runtime must never be able to SET ROLE to the security-definer owner.

## Verification state

- Original migration rehearsal on the disposable Neon branch: syntax executed; it exposed the incorrect broad owner.
- Corrected migration and test changes committed to PR #201.
- Exact-head CI for the corrected commits: not yet observed at checkpoint time.
- No production DDL/DML, role/grant/RLS changes, deployment, branch protection change, worker activation or certification performed.

## Next actions

1. Verify exact-head CI on the corrected PR #201 head; diagnose any migration/test failure.
2. Rehearse the corrected migration on a clean disposable PostgreSQL/Neon environment with the exact restricted role pre-provisioning contract.
3. Obtain independent security review of the owner role, membership and privilege boundary.
4. Integrate the verifier with the signed-token and request-transaction primitives only after dependency review; do not merge the four independent PRs blindly.
5. Keep production HOLD until the separate auth pool, application runtime role, all 67 table policies, route/worker transaction coverage, rollback plan and independent approvals are complete.
