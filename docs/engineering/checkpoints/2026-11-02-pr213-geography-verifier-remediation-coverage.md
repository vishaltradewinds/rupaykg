# PR #213 remediation coverage review — 2026-11-02

## Why this addendum exists

The live production trigger audit identified fail-open geography scope and global verifier membership lookup. A follow-up review of the candidate integration branch at exact head `cd96ec579e2eda726b3fbe9e2d261f5b2ce9d832` found that PR #213 already contains migrations intended to address most of those findings. The live production findings remain valid until the candidate changes are independently reviewed, merged through the correct integration base and deployed under controlled release gates.

## Candidate migrations reviewed

- `20261105_geography_scope_search_path_hardening.sql`: pins search_path to `pg_catalog, pg_temp` and schema-qualifies geography helper/trigger references. It preserves the prior no-verified-scope TRUE behavior, so it is hardening only, not fail-closed.
- `20261106_verifier_same_org_geography_scope.sql`: introduces `has_verification_permission_for_activity(identity, activity)`; joins the subject activity to organization membership in that same organization; requires verified geography scope and subject geography within scope; replaces `prevent_invalid_verification` for approved decisions.
- `20261107_verifier_subject_org_verified.sql`: further requires subject organization status VERIFIED before approval.
- `20261108_geography_scope_fail_closed.sql`: changes `organization_has_geography_scope` to require a matching VERIFIED scope record; no missing-scope implicit TRUE.

## Remaining candidate-code review findings

1. The migration series replaces `prevent_invalid_verification` for APPROVED decisions, but does not replace `enforce_verification_independence()`, which remains the separate trigger with global membership lookup. Decide whether pending/rejected verification records may be created by a verifier from another organization. If not, align both trigger functions; if yes, document the intentional difference and ensure no state transition can bypass approved-decision checks.
2. The new `has_verification_permission_for_activity` checks same-organization VERIFIED membership and geography, but does not itself join `identities` to require identity status VERIFIED and `suspended_at IS NULL`. Confirm whether the separate auth/trigger chain guarantees this for every call path; otherwise add it and test suspended identities.
3. `20261108` is fail-closed. Before applying, inventory existing organizations without VERIFIED geography scope and provide governed onboarding/backfill. Do not invent a pan-India scope or blanket-approve all organizations. National authority must be an explicit verified scope record supported by evidence.
4. Candidate migrations are not production changes. PR #213 is DRAFT and its base is `shakti/auth-bootstrap-application-integration-2026-11-01`, not `main`. Do not merge directly to main or retarget automatically. Reconcile the integration branch and review all cumulative commits/changes as a coherent release unit.
5. The candidate branch contains multiple migrations dated 2026-11-03 through 2026-11-10. Confirm intended migration sequence and that no future-dated migration is accidentally applied ahead of its approved release gate. Migration filename dates are ordering identifiers; they are not evidence of scheduled deployment approval.

## Exact-head CI evidence

PR #213 exact head `cd96ec5...` run [41499847180](https://github.com/vishaltradewinds/rupaykg/actions/runs/41499847180) SUCCESS. This supports that the candidate branch passed its configured CI, not that production migrations are approved or safe to activate. PR #213 remains draft, feature flag OFF, and unmerged.

## Release decision

Keep production READ-ONLY / HOLD. Keep EPR read route OFF, MRV worker OFF and certification OFF. No production changes made by this review.
