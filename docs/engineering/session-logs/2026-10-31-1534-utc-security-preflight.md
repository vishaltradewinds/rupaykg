# Session preflight — 2026-10-31 15:34 UTC

## Scope
Resume RupayKg from the committed latest pointer; verify repository CI/PR state and authoritative Neon production catalog before any repository writes.

## Repository evidence
- Repository: `vishaltradewinds/rupaykg`
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`
- PR #175: OPEN / DRAFT, base `main`, head SHA `4833e607c56176a7d0aff55dec7de88e77063037`.
- PR #161: OPEN / DRAFT, stacked on `shakti/integrate-government-inbox-worker-2026-10-31`, same head branch; do not merge independently.
- PR #173: OPEN / DRAFT, separate database/source-provenance stream; reconcile before merge.
- Exact-head CI for `4833e607c56176a7d0aff55dec7de88e77063037`: run #3931 / ID `41215002551`, COMPLETED / SUCCESS.
- `AGENTS.md` and latest resume pointer read. Latest pointer's recorded snapshot predates this verified HEAD and needs refresh.
- No merge, runtime deployment, production SQL write, migration, role/grant change or branch operation performed.

## Neon authority and read-only evidence
- Project `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole authoritative branch `main`, ID `br-restless-base-b44cip2h`; primary/default/ready.
- Other listed branches are staging/rehearsal only; none promoted or modified.
- Read-only query on database `rupaykg`: session/current user `rupaykg`; 67 public base tables; 0 RLS-enabled tables; 0 public policies; 92 migration rows; max version `20261021`.
- Catalog inventory confirms all 67 public base tables currently have RLS disabled.
- Project history retention: 21,600 seconds (6 hours); main branch `protected=false`.
- No database writes or settings changes performed.

## Immediate findings
- Production tenant isolation is NOT ESTABLISHED at the database layer.
- Existing repository security assessment and latest resume pointer contain obsolete assumptions/instructions about a specific deployment provider. The current batch will make repository guidance provider-neutral and keep Neon as the sole authoritative database.
- Table-by-table authorization classification remains incomplete; direct tenant-key and FK ownership must be mapped before policy design.
- Production remains HOLD; worker/scheduler/certification OFF; TRL 9 NOT ESTABLISHED.

## Next action
Create a committed, read-only production catalog inventory; remove stale provider-specific instructions from mandatory resume guidance; update immutable checkpoint and latest resume pointer. Do not change production.
