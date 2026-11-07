# Verification Authorization Independent Review Checklist — 2026-11-06

## Review target

Validation-only convergence rehearsal on branch `shakti/verification-context-convergence-rehearsal-2026-11-06`, exact head `e2f0887724049a032586f2ffeac6b9617d052793`, PR #319.

CI evidence:
- Workflow: 42262635985
- Run: 5824
- Conclusion: SUCCESS
- Verification authorization convergence rehearsal: PASS
- Tenant-isolation RLS acceptance harness: PASS
- Production container build: PASS
- Disposable backup/restore rehearsal: PASS
- Production startup migration/fixture prohibition: PASS

## Required independent DBA/security review

### A. Canonical authorization owner
- [ ] Confirm exactly one authoritative verification SECURITY DEFINER owner.
- [ ] Confirm `rupaykg_verification_guard` is NOLOGIN, NOSUPERUSER, NOBYPASSRLS.
- [ ] Confirm `rupaykg_auth_context_owner` is absent.
- [ ] Confirm verifier authorization does not use role-name authority.
- [ ] Confirm fixed `search_path=pg_catalog` on security-definer authorization functions.
- [ ] Confirm EXECUTE and table privileges are least-privilege and not PUBLIC.

### B. Tenant-bound authorization
- [ ] Cross-organization pending verification is rejected.
- [ ] Cross-organization rejected verification is rejected.
- [ ] Cross-organization approved verification is rejected.
- [ ] Same-organization explicit verifier permission succeeds when all other conditions hold.
- [ ] Role-name-only authority (VERIFIER/AUDITOR) is rejected.
- [ ] Unverified membership is rejected.
- [ ] Suspended identity is rejected.
- [ ] Unverified organization is rejected.
- [ ] Missing/pending/rejected geography scope is rejected.
- [ ] Foreign geography scope is rejected.
- [ ] Null geography is rejected.
- [ ] Self-approval is rejected.

### C. Context integrity
- [ ] Missing authenticated context fails closed.
- [ ] Invalid signature fails closed.
- [ ] Expired bearer session fails closed.
- [ ] Revoked bearer session fails closed.
- [ ] Context identity cannot be changed without re-authentication.
- [ ] Context organization cannot be changed without re-authentication.
- [ ] Context is bound to the current transaction xid.
- [ ] Context does not survive transaction boundaries/pool reuse.

### D. Decision provenance
- [ ] Authorization membership snapshot is captured from the authorization decision.
- [ ] Authorization role snapshot is captured from the authorization decision.
- [ ] Permission snapshot is captured from the authorization decision.
- [ ] Authorization checked timestamp is captured.
- [ ] Client-supplied authorization snapshot values cannot override server-derived values.
- [ ] Verification UPDATE is rejected.
- [ ] Verification DELETE is rejected.
- [ ] Verification TRUNCATE is rejected.
- [ ] Corrections are represented by superseding verification records.

### E. Concurrency
- [ ] Membership revocation racing verification fails closed.
- [ ] Role permission removal racing verification fails closed.
- [ ] Identity suspension racing verification fails closed.
- [ ] Organization suspension racing verification fails closed.
- [ ] Geography-scope removal/reassignment racing verification fails closed.
- [ ] Lock ordering is documented and deadlock-tested.

### F. Migration/release boundary
- [ ] Historical production migration 096 is preserved as immutable evidence.
- [ ] No migration replay of 096 is authorized merely because its source is absent from the active directory.
- [ ] Staging-only migrations are not copied into production without independent review.
- [ ] Production API startup cannot execute migrations or fixtures.
- [ ] Runtime role is not table owner and does not retain BYPASSRLS.
- [ ] Production RLS/grants/roles are independently verified before any release.

## Evidence classification

CI success is **engineering evidence only**. It does not establish:
- live production RLS;
- live production role/grant ownership;
- live external-provider integration;
- field acceptance at SITE-JBP-01;
- regulatory approval;
- independent assurance;
- production certification;
- TRL 9.

## Release decision

Current decision: **HOLD**.

Required before production release:
1. Independent DBA/security review completed and recorded.
2. Authoritative production database role/RLS/grant state independently reconciled.
3. Migration lineage P0 #214 reconciled.
4. Verification authorization P0 #215 accepted by independent review.
5. Full tenant-isolation programme accepted under real non-owner NOBYPASSRLS runtime identity.
6. Operational/field/MRV evidence completed for SITE-JBP-01.
7. Explicit release approval.

No production mutation, deployment, merge or certification is authorized by this checklist.
