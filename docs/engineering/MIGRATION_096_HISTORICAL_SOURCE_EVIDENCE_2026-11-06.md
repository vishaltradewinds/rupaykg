# Migration 096 — Historical Source Evidence

**Status:** immutable historical evidence record; validation/reconciliation only.

## Provenance

Recovered from Git commit `ca8f4100782e13f8d72106187fafc8e1e446214f` after production read-only reconciliation identified ledger version `096_verification_authorization_provenance.sql` with no active source file.

Recovered blob SHA:
`258b1f4534efbf915688f78aa84d4ec24a47cbc0`

The source was subsequently removed from main in commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`.

## Recovered semantics

The migration:
- adds four authorization snapshot columns to `verifications`;
- replaces `prevent_invalid_verification()`;
- requires the approved verification activity to resolve to an organization;
- rejects self-verification by the activity actor;
- requires a VERIFIED organization membership for the verifier in the activity's exact organization;
- requires a VERIFIED, non-suspended identity;
- requires one of the explicit permission keys `VERIFY_EVIDENCE`, `verification:approve`, or `verification.approve`;
- captures membership ID, role ID, permission JSON and authorization-check timestamp at approval time;
- replaces the `verifications_integrity_guard` trigger.

## Reconciliation boundary

This recovered source is preserved for audit lineage. It is **not** being replayed blindly, copied into production, or treated as the final verification authorization implementation.

The current convergence work intentionally supersedes unresolved weaknesses identified in production, including the legacy role-name authorization path and the absence of an independently enforced immutable decision-time snapshot.

## Required next evidence

1. Compare the recovered source checksum against the production migration lineage record.
2. Compare the resulting production function/trigger definitions against the recovered source.
3. Reconcile application/deployment evidence for how ledger version 096 reached production after source removal from main.
4. Independently review the forward-only replacement/convergence migration.
5. Preserve the production database in READ-ONLY/HOLD until lineage and security review are complete.

**Evidence boundary:** historical source preservation only. This document does not establish production authorization correctness, live tenant isolation, regulatory approval, certification, field acceptance, or TRL 9.
