# RupayKg — Current Source of Truth

**Checkpoint:** 2026-10-31  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Canonical implementation branch:** `main`  
**Authoritative live database:** Neon `rupaykg-production-fresh` / project `steep-mud-79906940` / branch `main` (`br-restless-base-b44cip2h`) / database `rupaykg`.  
**Detailed database inventory:** [Authoritative Database and Repository Policy](engineering/RUPAYKG_AUTHORITATIVE_DATABASE_AND_REPOSITORY_POLICY_2026-10-31.md).

## Release decision

**Production HOLD · worker OFF · scheduler OFF · certification OFF · TRL 9 not claimed.** Do not merge, deploy, certify, replay/rollback migrations or enable scheduled processing until the applicable Shakti, security, migration, operational and independent acceptance gates pass.

A live service, HTTP 200, successful build or green CI is not by itself proof of regulatory readiness, complete production acceptance or certification.

## Current worker engineering

- PR #157 is the worker integration parent.
- PR #161 is the atomic claim / concurrency hardening follow-up; it remains draft/open/unmerged.
- Runtime-code head `fd2e52e3f73d03f73632bdccd0f0b6a03193f8b5` passed GitHub Actions run [#41205115744](https://github.com/vishaltradewinds/rupaykg/actions/runs/41205115744).
- Current PR #161 head `1b0d972b3b8899f4960e5030856fff645b177941` is one documentation-only commit beyond the tested runtime head.
- The worker migration set is not applied to authoritative production main. Production main lacks inbox/event/crosswalk/source-snapshot relations. Legacy staging contains only inbox/event tables and is not a valid worker target.

## Remaining blockers

1. Approve national system-queue versus tenant-scoped processing authority.
2. Define RLS/tenant isolation or formally approve a narrowly bounded global queue model.
3. Verify the exact deployment principal without exposing secrets.
4. Rehearse the complete ordered migration chain on a fresh disposable branch derived from authoritative production main.
5. Independently review role ownership, grants, SECURITY DEFINER functions, trigger semantics, search_path and worker access.
6. Obtain exact-head CI and separate change-window/deployment approval.

## Database and repository rules

Production main is the only system of record. Staging, rehearsal, local and CI databases are test environments only. Do not write to production or use stale staging as a substitute. Preserve migration history; resolve discrepancies only through reviewed forward-only changes. See the authoritative database policy linked above.

The current implementation repository is authoritative; the former `rupaykg-aistudio` repository is reference-only. Preserve historical documents and legacy domain references as historical knowledge, but do not treat them as current implementation specifications.

## Shakti and TRL

Apply Shakti Standards across discovery, evidence, statutory boundaries, feasibility, design, engineering, testing, independent review, approval, deployment, operation, measurement and continuous assurance. CI is engineering evidence only. TRL 9 is not claimed.
