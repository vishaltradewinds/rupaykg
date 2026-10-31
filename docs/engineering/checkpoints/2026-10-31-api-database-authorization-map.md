# RupayKg immutable checkpoint — API/database authorization mapping — 2026-10-31

## Repository state
- Repository: `vishaltradewinds/rupaykg`
- Branch: `shakti/atomic-inbox-claim-2026-10-31`
- Previous checkpoint HEAD: `d620357052b999e52a24f55f14c14debeae54546`
- Route authorization map commit: `af9f8f2ca655ebe2a0fa2a99f3ec227c5f4b39e8`
- Latest route map: `docs/security/API_ROUTE_DATABASE_AUTHORIZATION_MAP_2026-10-31.md`
- Previous checkpoint: `docs/engineering/checkpoints/2026-10-31-production-catalog-security-refresh.md`
- No PR merge or production deployment performed.

## Work completed
1. Read source files for authentication, tenant transaction context, API server and 15 route families.
2. Enumerated route registrations in 15 files and recorded whether each source uses shared tenant transaction helper, direct pool query or manual client transaction.
3. Confirmed `authenticate()` derives identity from hashed bearer session, checks identity state, loads verified memberships and enforces explicit organization selection for multi-organization identities.
4. Confirmed shared tenant transaction helper derives identity/organization from server AuthContext and uses transaction-local custom GUC values on one checked-out connection. Its source explicitly says callers must not assume RLS is enabled.
5. Confirmed helper usage is not universal: auth, registry, sync, onboarding hierarchy, intelligence and platform-admin files do not reference it; some contain manual transaction/client or direct pool patterns. These require their own scope models and are not automatically vulnerabilities.
6. Recorded first-pass distinctions for organization-owned, FK-child, identity-private, bilateral/multi-party, device/offline, governance/onboarding, platform-control, global-reference and append-only provenance data.
7. Added `docs/security/API_ROUTE_DATABASE_AUTHORIZATION_MAP_2026-10-31.md`.

## Important source findings
- Application-level authorization exists but cannot substitute for database RLS; production has 0/67 public tables with RLS and 0 public policies.
- Custom transaction-local GUCs prevent stale pooled state but are caller-forgeable by any SQL principal with direct database access; cannot be the sole proof of identity/membership.
- Registry/settlement are bilateral and cannot be safely constrained by a simplistic one-organization predicate.
- Offline sync is device/identity/organization/activity bound and must preserve idempotency, cursor and replay semantics.
- Onboarding and platform-admin are distinct control-plane paths with hierarchy/geography authority and separation-of-duties requirements.
- Public views previously inventoried: 0. Production trigger inventory includes many integrity/lifecycle guards; exact function bodies, SECURITY DEFINER/search_path, ACLs/default privileges and sequence grants still need detailed review.
- The static route count is syntactic source inventory only; it is not a complete route → SQL → table → operation → principal proof.

## Production safety
- Neon production remains `rupaykg-production-fresh` / project `steep-mud-79906940`, branch `main` / `br-restless-base-b44cip2h`, database `rupaykg`.
- No production DDL/DML, migration, RLS policy, role/grant, credential, branch, backup setting, deployment or worker change occurred.
- Production release HOLD; tenant isolation NOT ESTABLISHED; worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.

## Next ordered actions
1. Continue exhaustive route-handler → SQL callsite → table → operation → principal → tenant/device/platform-context map, including dynamic/indirect SQL.
2. Complete FK ownership classification for every public table.
3. Inspect function/trigger definitions, SECURITY DEFINER and search_path; inspect schema/table/sequence ACLs and default privileges.
4. Design separate least-privilege service roles and non-forgeable context/capability validation.
5. Establish Neon backup/PITR/restore and independent RPO/RTO evidence.
6. Rehearse table-specific RLS and migrations on a disposable production-derived Neon branch; test forged GUC, cross-tenant, pool, revoked membership, bilateral, platform-admin and offline-sync cases.
7. Independent review and explicit approval before production changes.

## Explicit NOT DONE
No RLS policy is designed as production-ready or applied. No tenant isolation claim. No production migration, role/grant change, worker activation, regulator acceptance, external credit issuance/settlement, hardware field certification or TRL 9 claim.
