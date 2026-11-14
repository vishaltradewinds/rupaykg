# Async mirror worker integration dependency audit — 2026-10-31

## Decision

Do not merge, cherry-pick, or transplant the historical AI-intake feature branch wholesale. Do not integrate the worker into `main` until its runtime dependency closure, migration order, and PostgreSQL acceptance evidence are reviewed as one coherent change set.

## Repository lineage evidence

- `intelligence/ai-evidence-intake-middleware` compares to `main` as **567 commits ahead and 4 behind**, with a divergent merge base. The comparison contains broad changes across API routes, authentication, evidence, geography, migrations, tests, CI, and documentation. It is a provenance/feature lineage, not a safe integration base.
- PR #142 is based on that feature branch and changes `apps/src/async-mirror-worker.ts` plus CI.
- PR #144 is stacked on PR #142 and changes the worker plus its unit tests and CI. It is closed without merge; preserve its changes as source evidence only.
- PR #122 is closed without merge and contains the real-PostgreSQL worker acceptance test. Its branch is not a safe merge base.
- PR #143 is the CI trigger correction for the feature-base lineage. At audit time it has no PR-triggered workflow run and no submitted review record. Do not infer approval from its existence.
- PR #142 exact head `7d73517997e902af0550f2773763b585abc2fc4e` has a successful workflow run (`41099253679`), including the disposable PostgreSQL acceptance workflow step. This is engineering evidence for that exact feature-branch head, not approval to merge the branch or proof of production equivalence.

## Source-level worker findings

- PR #142's worker claim predicate includes `lease_until IS NULL OR lease_until < now()` for expired `PROCESSING` rows, aligning reclamation with the pre-claim retry-exhaustion sweep.
- PR #144 additionally aligns the read-only reconciliation count with the same null-or-expired predicate and adds a unit assertion.
- Worker completion updates are fenced by both `status='PROCESSING'` and the row's `lease_token`; stale workers therefore cannot finalize a row after a newer claim changes the token.
- The worker uses `FOR UPDATE SKIP LOCKED` for bounded claims and records only payload-free transition metadata in the event-history design.
- Structural and jurisdiction validation are explicitly non-authoritative: the worker summary sets `officialAcceptance=false`, `authoritativeMrvMutation=false`, and `guardianSubmission=false`. No official acceptance, MRV credit decision, or Guardian/HCS submission may be inferred from an internal `VALIDATED` or `UNRESOLVED` status.
- The worker runtime queries `government_jurisdiction_crosswalks`, `authoritative_source_snapshots`, `activities`, and `organization_has_explicit_geography_scope(...)`. These are not supplied by the four migrations restored in PR #155 alone.

## Migration and runtime dependency boundary

PR #155 restores only the four historical migration sources dated 20261022–20261025. Their exact historical Git blobs were verified and the PR's exact-head CI passed. That does **not** supply the worker's complete jurisdiction-crosswalk dependency closure.

The feature lineage also contains subsequent migrations, including 20261031 jurisdiction crosswalk and later source-snapshot, evidence-binding, geography, and regulatory-source controls. These migrations are not part of PR #155. Live production's stronger verifier-authorization controls must remain untouched. The rehearsal-only 20261101 `UNRESOLVED` constraint remains a separate unledgered schema-drift issue; it must not be silently promoted to production.

The first restored inbox migration's status check does not include `UNRESOLVED`; the worker writes `UNRESOLVED` only when the crosswalk is absent or ambiguous. A corrected status constraint must be separately sourced, reviewed, ledgered, and tested in a disposable environment. The 20261101 crosswalk migration is not approved for automatic restoration or replay.

## Focused integration plan

1. Freeze the feature branch as provenance; do not merge or cherry-pick its 567-commit divergence.
2. Establish the exact minimal runtime closure: worker, canonical payload hash, required crosswalk/source-snapshot functions and tables, and the required ordered migrations. Review each dependency against current `main` and PR #155.
3. Bring the null-lease claim and reconciliation fixes together with unit tests, and include the real-PostgreSQL acceptance suite from PR #122 only after adapting it to the canonical migration sequence.
4. In disposable PostgreSQL, assert: null/expired lease recovery; attempts-exhausted quarantine; stale fencing-token rejection; concurrent claim exclusion; append-only payload-free event history; retry/backoff; unresolved on missing/ambiguous crosswalk; unknown statuses rejected; and zero official acceptance/MRV/Guardian side effects. Confirm the named integration tests actually execute with zero skips.
5. Obtain independent review of worker logic, migration chronology, authorization/geography boundaries, and data privacy.
6. Only then create a small PR against current `main`. Keep scheduler and deployment disabled until separately approved.

## Current Shakti gate

- Source inspection: partial pass; null-lease and fencing behaviours are present in the reviewed source.
- PR #142 exact-head CI: passed; engineering-only.
- PR #144 exact-head CI: no current PR-triggered run observed.
- PR #122 updated acceptance head: no current PR-triggered run observed.
- PR #143 CI-trigger correction: no workflow run and no review record observed.
- Minimal dependency closure on current `main`: not yet established.
- Disposable reconstruction of production-equivalent schema: not established.
- Independent security review: pending.
- Production database writes/DDL, merge, deployment, scheduler activation, and certification: **HOLD / OFF**.
- TRL 9: **not established**; CI and source inspection do not demonstrate sustained operation in a real environment.



## Follow-up migration source recovery

On 2026-10-31, the historical `20261101_async_mirror_unresolved_crosswalk.sql` source was restored to draft PR #155 as a fifth source-only migration. Its current Git blob SHA `4f9776bc449025e795cb0d5c93e8bace9dea280b` exactly matches the historical blob. This is a source restoration for review and CI only; it has not been applied to staging, rehearsal, or production.

This migration is required for the worker's `UNRESOLVED` write path because the 20261022/20261023 base inbox status constraints do not include that internal status. The migration must remain sequenced after the inbox and worker-lease migrations. Its presence in PR #155 does not authorize production replay or resolve the independent live schema-ledger drift.

## Worker query dependency chain confirmed from source

The worker's verified-crosswalk resolution query joins:
- `government_jurisdiction_crosswalks` (introduced in 20261031),
- `authoritative_source_snapshots` and its `authority_code` / `validation_status` / effective-date fields (introduced in 20261104, with authority code added in 20261105),
- `source_snapshot_id` on crosswalk rows (added in 20261105),
- `organization_has_explicit_geography_scope(uuid,uuid)` (introduced in 20261030),
- `activities` (pre-existing core table).

Therefore, restoring only 20261022–20261025 plus 20261101 is not enough to make the worker query executable. At minimum, the schema dependency path includes 20261030, 20261031, 20261104 and 20261105. The integrity of evidence binding, dual-control crosswalk approvals, approved-snapshot immutability and expiry/retirement controls also depends on the associated 20261102 and 20261107–20261109 migrations. Those later files must be reviewed as a coherent governance chain, not cherry-picked to make tests pass.

The current feature branch has additional migrations and API/runtime changes well beyond this closure. Do not restore that branch's entire migration sequence into `main` as a shortcut. First reconstruct the exact base schema and dependencies, then decide which controls are appropriate for a focused, independently reviewed integration.

## New PR #155 state

- Fifth source file restored: `migrations/20261101_async_mirror_unresolved_crosswalk.sql`.
- Historical blob equality: verified.
- PR #155 remains draft; no merge or database application.
- CI for the new head: pending / not yet observed at audit time.
