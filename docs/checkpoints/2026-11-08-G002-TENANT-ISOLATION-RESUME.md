# RupayKg — Resume Checkpoint — 2026-11-08

## Canonical working repository
- Repository: vishaltradewinds/rupaykg
- Branch: main
- Checkpoint branch: checkpoint/2026-11-08-g002-tenant-isolation
- Checkpoint HEAD: e8a230bbefad078fd11cebf543efe6a258d88559
- Do NOT use vishaltradewinds/rupaykg-aistudio as the primary engineering repository.

## Current workstream
G-002 — Authoritative DB/runtime identity + tenant isolation production hardening under Shakti Standards.

## Completed in this checkpoint
- Numbered migrations 097, 098, 099 prepared and registered:
  - 097 runtime tenant-isolation contract
  - 098 authentication bootstrap
  - 099 RLS policy foundation
- SECURITY DEFINER boundaries hardened.
- PUBLIC execute revoked for protected tenant-context/authentication functions.
- SECURITY DEFINER acceptance gate added.
- Core server tenant-scoped routes bound to transaction-scoped tenant context:
  - geography roots
  - geography children
  - resource-flow creation
  - measurement creation
- Production settlement mutation paths previously hardened with DB-authoritative identity/liveness revalidation.
- Migration system remains filename/version ordered; do not create duplicate or unnumbered production migrations.

## Production DB status
Neon project: steep-mud-79906940
Production branch: br-restless-base-b44cip2h
Database: rupaykg

Read-only inspection confirms:
- rupaykg_app_runtime exists and is non-BYPASSRLS.
- rupaykg_runtime_login exists and is non-BYPASSRLS.
- runtime login inherits rupaykg_app_runtime.
- protected tenant tables are still owned by elevated rupaykg.
- protected tenant tables still have RLS disabled.
- production migration ledger is still below 097.
- production does not yet contain the complete 097/098/099 application isolation foundation.
- production SECURITY DEFINER boundary is therefore not yet acceptance-complete.

## Critical safety rule
Do NOT enable production RLS, transfer protected-table ownership, or perform destructive production DDL until:
1. migration SQL is validated in controlled rehearsal;
2. SECURITY DEFINER boundary acceptance passes;
3. DDL/runtime role separation is proven;
4. all protected-table policies match actual schema;
5. cross-tenant negative tests pass;
6. rollback evidence is prepared.

## Next execution sequence
1. Validate 097–099 against the actual canonical schema.
2. Validate SECURITY DEFINER functions and grants in rehearsal.
3. Complete control-plane/platform-admin tenant boundary review.
4. Run pre-RLS acceptance.
5. Establish controlled DDL/owner role separation.
6. Apply 097–099 to rehearsal and verify.
7. Run cross-tenant negative acceptance.
8. Prepare production migration/rollback evidence.
9. Only then perform controlled production RLS/ownership activation.
10. Re-run live acceptance and preserve evidence.
11. Update TRL assessment only from verified engineering + operational + field + regulatory evidence.

## TRL posture
RupayKg is NOT TRL 9 at this checkpoint.
Engineering hardening is progressing, but production tenant-isolation acceptance, field evidence, and remaining integrations/certification gates are still outstanding.

## Resume instruction
When resuming RupayKg, start from this checkpoint and the canonical repo main. Reconcile actual HEAD/DB state before making changes. Do not assume production DDL has been applied.
