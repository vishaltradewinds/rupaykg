# RupayKg Release Stack Reconciliation — 2026-11-05

## Purpose

This checkpoint synchronizes the production-release dependencies across PRs #289, #290, #291 and #298. It is a release-control artifact, not authorization to merge or deploy.

## Current verified heads

| PR | Function | Head | CI |
|---|---|---|---|
| #289 | Remove implicit web-startup migrations | 2d5e94c930a283113e40907904592023a710b02d | #5540 SUCCESS |
| #290 | Read-only migration lineage gate | f340a9f183e699152910e15b54576bd6b6360a38 | #5614 SUCCESS |
| #291 | Protected migrator | 05c218d06b665c00ce9213e484d578f50d4a8e58 | #5566 SUCCESS |
| #298 | Security/tenant convergence rehearsal | 5c4bdc96d65e2631976cdf13832326519bcc294a | #5613 SUCCESS |

## Release topology

These changes are interdependent and must not be merged as independent green PRs.

1. #289 removes schema mutation from long-lived web startup.
2. #290 establishes read-only migration source/ledger lineage controls.
3. #291 provides the separately invoked protected migrator and manifest controls.
4. #298 validates the security/tenant convergence stack together with the protected migration path.

The combined architecture must be reviewed as one release system.

## Production blockers

The following remain unresolved before controlled production release:

- Migration 096 is production-applied but absent from active main source.
- The historical applicability/dependency decision for 096 is not yet independently approved.
- 20261022–20261025 remain non-production-applicable pending source recovery/classification.
- Actual Render runtime database identity has not been proven.
- Production RLS/tenant isolation is not active.
- The combined security rehearsal is validation-only.
- Independent DBA/security review has not been evidenced.
- Backup/restore and production-representative upgrade rehearsal remain required.
- No immutable reviewed release migration manifest has yet been approved for a production release.
- No controlled production migrator execution has been authorized.

## Release rule

CI success is necessary but insufficient.

No merge/deployment should be treated as production authorization until the complete stack passes independent review and the production release gates are evidenced.

**Decision: Production READ-ONLY / HOLD.**
