# Verification authorization guard-role design and proof

**Status:** draft engineering evidence only — not approved for production execution.

**CI:** exact-head validation is being rerun on the superseding draft PR; prior-branch success is not used as a substitute.

## Purpose

The candidate verification authorization trigger uses `SELECT ... FOR SHARE` to serialize a decision against changes to its evidence, activity, organization, verifier membership, role permissions, and identity status. PostgreSQL requires UPDATE privilege on at least one column of each locked table. Giving the API role broad UPDATE would defeat least privilege.

The candidate migration therefore assigns the two SECURITY DEFINER trigger functions to a dedicated `rupaykg_verification_guard` role.

## Guard-role boundary

The migration configures the role as:

- `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS`;
- not a member of any other role and not granted to the API role; the designated migration principal retains a membership with `SET FALSE` after ownership transfer, so it cannot directly assume the helper; when it created the role, PostgreSQL may retain ADMIN OPTION for that principal, but no API/runtime role is a member;
- not owner of evidence, activities, organizations, memberships, roles, identities, verifications, or geography tables;
- owner only of the two trigger functions, with a fixed `search_path` and schema-qualified object references.

The helper receives SELECT on the authorization rows and geography lookup inputs. It receives only column-scoped `UPDATE(id)` on evidence, activities, organizations, memberships, roles, and identities to satisfy PostgreSQL row-lock privilege checks. It does not receive table-wide UPDATE, INSERT, DELETE, or TRUNCATE on those protected tables.

The migration does not create or designate the API runtime role. The integration test creates a disposable NOLOGIN API proof role with INSERT on `verifications` only, and removes it after the test.

## Lock and authorization sequence

The trigger derives organization and geography from the evidence/activity relationship; it does not accept caller-supplied organization context as authority.

The intended lock order is:

1. evidence row;
2. activity row;
3. owning organization row;
4. verifier membership row;
5. membership's role row;
6. verifier identity row.

The organization row is locked before checking VERIFIED status and geography scope. A companion trigger on `organization_geography_scopes` takes an UPDATE lock on the owning organization before a scope insert, update, or delete. This serializes verification against organization suspension and geography-scope mutation. The verification trigger evaluates geography scope with its own query after acquiring the organization lock; it deliberately does not call the existing STABLE geography helper. The scope-race fixture replaces the existing verified root with a different root while a verification is waiting, so the old activity must be rejected after the scope change commits. Membership, role and identity are then locked and re-read in that order before permission is evaluated and provenance is snapshotted.

## Disposable full-schema proof

The integration test runs after the repository's active migrations have been applied to ephemeral PostgreSQL. It applies the candidate verification migration over the actual RupayKg schema and tests:

- one authoritative verification trigger replaces both historical trigger names;
- a non-owner API proof role can insert a valid decision through the SECURITY DEFINER trigger without direct SELECT on evidence;
- the decision captures membership, role, permission snapshot and timestamp;
- the API proof role has no UPDATE, DELETE or TRUNCATE privilege on verification decisions;
- the helper role is NOLOGIN/NOBYPASSRLS, does not own protected tables, has only the required column-scoped lock privileges, and cannot be assumed by the API proof role;
- concurrent role permission revocation, membership deactivation, identity suspension, organization status change and geography-scope mutation serialize with verification and fail closed after the competing change commits. The first full-schema run exposed a fixture error: it added a second valid geography root without revoking the original root, so the activity correctly remained in scope. The fixture now revokes the old root and inserts the replacement before asserting denial.

A separate CI SQL proof executes the helper ownership-transfer sequence as a non-superuser CREATEROLE migration principal. It verifies temporary SET access for function ownership transfer and the final SET-disabled migrator membership. This tests PostgreSQL privilege mechanics, not the actual Neon migration credential or its schema grant options.

The test runs only against GitHub Actions disposable PostgreSQL. It does not connect to Neon, Render, or any persistent database.

## Explicit limitations and release blockers

- The test API role is synthetic and NOLOGIN. It is not evidence of the actual Render API database identity or grants.
- Production catalog inspection found the visible `rupaykg` role is table owner and BYPASSRLS; production RLS/FORCE RLS is disabled on the inspected security-critical tables. This migration does not change that state.
- The migration does not define RLS policies. If RLS is enabled, the helper role's access and any tenant-context mechanism must be separately designed and tested. A caller-controlled session variable is not trusted identity.
- The migration temporarily grants the current migration principal `SET ROLE` on the helper solely to transfer function ownership, then resets that membership to `SET FALSE`. If the principal created the role, PostgreSQL's creator grant can retain ADMIN OPTION; the migration verifies that no other role is a member. This requires the actual migrator to have CREATEROLE/role-administration authority and must be proven using the intended credential. Do not assume disposable CI's superuser migration identity is equivalent.
- Existing table-owner, superuser, replication, and administrative bypass paths remain outside the synthetic API-role proof. Append-only guarantees against UPDATE, DELETE, TRUNCATE, owner, superuser and replication paths require separate controls and tests.
- The trigger does not certify a real MRV activity, evidence authenticity, statutory eligibility, or field verification.
- Independent DBA/security review and explicit founder authorization remain required before any production migration, role, grant, RLS, or deployment change.

**Production posture:** read-only / release HOLD. No production database has been modified and no TRL 9 or production certification claim is made.
