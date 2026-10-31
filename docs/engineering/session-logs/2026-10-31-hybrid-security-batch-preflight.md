# RupayKg session preflight — hybrid architecture and security release batch

**Session date:** 2026-10-31 (UTC)  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch at preflight:** `shakti/atomic-inbox-claim-2026-10-31`  
**HEAD at preflight:** `d36ef5b81c3fcfbfe047f90b5ca8f9d45d9b3934`  
**Latest prior resume checkpoint:** `docs/engineering/checkpoints/2026-10-31-gate1-current-candidate.md`

## GitHub preflight
- Confirmed branch existed and HEAD matched the latest resume point.
- PR #175 open/draft, base `main`; PR #161 open/draft on same head branch, stacked on `shakti/integrate-government-inbox-worker-2026-10-31`.
- PR #173 and #160 also open/draft; separate workstreams. No PR was merged.
- Exact preflight HEAD CI: run #3922 / `41214177450`, commit `d36ef5b81c3fcfbfe047f90b5ca8f9d45d9b3934`, completed SUCCESS.
- Render production deployment remains associated with `main` at the previously observed `862512c8c904cef0f604df0350f02672318953af`; candidate code is not live.

## Neon preflight (read-only)
- Project `rupaykg-production-fresh` / `steep-mud-79906940`.
- Authoritative branch `main` / `br-restless-base-b44cip2h`; database `rupaykg`.
- `main` is default/primary and `protected=false`.
- Project history retention: 21,600 seconds (6 hours).
- Production: 92 migration ledger rows through `20261021`; 67 public tables; 0 RLS enabled; 0 FORCE RLS; 0 public policies.
- All 67 public tables owned by `rupaykg`; role has BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION, LOGIN and is a member of `neon_superuser`.
- Catalog inspection session was `session_user=current_user=rupaykg`; this is the Neon inspection identity, not proof of Render's runtime identity.
- Production-derived rehearsal `br-young-mouse-b4jhqbci`: 78 public tables and 0 RLS-enabled public tables in read-only catalog check; not production authority.
- No branch protection, backup, restore, schema, data, role, grant, credential, migration or worker change was performed.

## Scope accepted for this batch
Adopt the hybrid architecture: **national system-level public-source ingestion + organization-scoped downstream execution**. National authority over the source queue does not authorize reading private tenant evidence. The selected architecture is a target baseline; security/compliance sign-off and production release approval remain pending.
