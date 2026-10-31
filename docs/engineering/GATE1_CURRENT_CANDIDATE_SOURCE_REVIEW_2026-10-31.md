# RupayKg Gate 1 — current candidate source and execution-context review

**Evidence date:** 2026-10-31  
**Repository:** `vishaltradewinds/rupaykg`  
**Reviewed branch:** `shakti/atomic-inbox-claim-2026-10-31`  
**Reviewed HEAD:** `ca71c1857a71ed73ca700bbeb2d49be251e85f49`  
**Exact-head CI:** run #3918 / `41213646257`, completed SUCCESS (validate job SUCCESS).  
**Review scope:** current branch source, route registration, connection/pool factories, Render manifest and Docker command. Static source review; not a full independent security certification.

## 1. Executive conclusion

Gate 1 is materially advanced, but **RLS and DB least privilege remain NOT ESTABLISHED**. Several tenant-facing routes now use transaction-local tenant context through `createTenantTransaction`; the remaining paths belong to distinct access domains (identity/auth, governance, platform admin, field-device sync, bilateral registry/settlement, global catalogs and multi-organization aggregates) and must not be forced into a simplistic single-organization policy.

The earlier first-pass inventory and priority-route review are historical snapshots. This document is the current source-registration reconciliation for HEAD `ca71c185`. It supersedes stale route-level statements where the current source differs, without deleting the earlier audit history.

## 2. Exact branch / PR / deployment state

- Branch HEAD: `ca71c1857a71ed73ca700bbeb2d49be251e85f49`.
- PR #175 targets `main`; open and draft. Exact-head CI run #3918 succeeded.
- PR #161 also points to this same head branch but targets `shakti/integrate-government-inbox-worker-2026-10-31`. It is a stacked/overlapping review path; reviewers must account for both PR bases.
- At comparison time, review branch vs deployed main commit `862512c8c904cef0f604df0350f02672318953af`: 261 commits ahead, 1 behind, 85 changed files. Recompute before merge or deployment.
- Render live service `rupaykg` continues to deploy from `main`; its latest observed live commit is `862512c8c904cef0f604df0350f02672318953af`. Review-branch security code is not thereby live.
- No production DB change, RLS change, grant/role change, deployment or worker activation occurred in this review.

## 3. Route registration and transaction-boundary map

The following counts are literal route registrations found in current source; nested registration is noted to avoid double-counting. A transaction wrapper count is not itself proof that every statement is scoped; exact SQL and authorization still need review.

| Module | Routes in source | Current execution pattern | Gate 1 disposition |
|---|---:|---|---|
| `server.ts` | 10 including health/status/overview/catalog/geography/sync proxy/resource-flow/measurement/static | Two tenant writes use `createTenantTransaction`; overview and geography have direct pool reads / separate authorization-read paths; sync proxy delegates to field-sync endpoints | Refactor overview/geography into explicit consistent scoped read contexts; retain health/status/global catalog as separate classes |
| `auth-routes.ts` | 8 | Direct pool reads/writes plus manual checked-out transactions for identity/session/onboarding | Identity/control-plane context; self-only and pre-tenant policies required |
| `onboarding-hierarchy-routes.ts` | 3 | Direct pool review-queue/authority reads and manual transactions for legal verification/approval | Governance/jurisdiction reviewer context; revalidate authority inside same write transaction |
| `value-routes.ts` | 9 | Tenant transaction helper used for carbon, EPR, ESG and BWG paths; helper functions accept PoolClient and are passed the transaction client | Stronger than older inventory claimed; verify all query calls remain on supplied client and preserve statutory rule versioning |
| `registry-routes.ts` | 8 | Local `tx(pool,...)` helper, row locks and append-only registry/settlement events; does not set the shared tenant GUCs | Do not apply ordinary single-tenant RLS blindly; credential owner and payer/payee are lifecycle/bilateral access classes |
| `sync-routes.ts` | 7 | Manual checked-out transactions for device enrollment, verification, sync envelopes and conflict resolution; some direct pool reads; no shared human-tenant GUC | Separate device-principal context and policies required |
| `workspace-routes.ts` | 8 | Shared tenant transaction helper; some workspace views deliberately aggregate across verified memberships when active organization is absent | Confirm multi-organization UX contract; single-org RLS context cannot silently replace it |
| `bwg-routes.ts` + `epr-return-routes.ts` | 1 + 4 | Tenant transaction helper in BWG route and EPR return lifecycle routes | Tenant-bound; review parent/child ownership and external submission evidence separately |
| `cpcb-swm-routes.ts` | 3 | Tenant transaction helper | Tenant-bound; ensure reviewer/system workflow is separate from ordinary tenant actions |
| `intelligence-routes.ts` | 1 | Direct pool permission/geography/projection queries | P1 transaction-boundary gap; multi-org semantics need explicit policy |
| `mrv-routes.ts` | 4 | Tenant transaction helper for authorization/read/write; separate checked-out connection holds a session advisory lock during idempotency workflow | Review lock lifetime/error cleanup and ensure tenant data SQL stays inside context client |
| `evidence-vault-routes.ts` | 4 | Tenant transaction helper | Tenant-bound; storage malware scan/quarantine remains separate operational gap |
| `statutory-routes.ts` | 5 | All five routes now use tenant transaction helper; module is registered by `registerMrvRoutes` | Current code differs from older review claiming direct-pool writes; still has statutory methodology/rule issues below |
| `platform-admin-routes.ts` | 16 | Platform Super Admin authorization reads via pool; audited write paths use a local transaction helper; some direct reads | Separate privileged control-plane role; revalidate authorization within transaction and prevent generic tenant bypass |

## 4. Current findings — what improved

1. `database-context.ts` derives identity and active organization from server-verified `AuthContext`, requires verified membership and fails closed without an explicit active organization.
2. It checks out one client, begins a transaction, sets `rupaykg.identity_id` and `rupaykg.organization_id` with transaction-local `set_config(..., true)`, runs callback SQL on that same client, commits/rolls back and releases.
3. The helper explicitly documents that it does not itself enable RLS; callers still need application authorization.
4. Current source uses this helper across value, BWG/EPR returns, CPCB-SWM, workspace, MRV, evidence vault, statutory and selected core server write routes.
5. Value-route helper functions `hasValuePermission` and `evidenceIsVerified` accept `Pool | PoolClient`; current reviewed call sites pass the checked-out transaction client. Do not infer direct-pool use merely from the helper parameter type.
6. Statutory routes have been refactored to transaction-bound operations since the older statement-level review. They must still be assessed for regulatory correctness and actual route wiring.

## 5. Remaining P1 access-context gaps

### A. Identity and authentication
- Auth registration/login/session creation, identity profile, membership and onboarding application paths use pool queries and manual transactions.
- These are pre-tenant control-plane operations; design a narrowly scoped identity/auth role and self-only access policies. Do not require tenant GUC where no active organization exists.
- Registration and onboarding include preflight queries followed by writes in separate transactions. Review race/uniqueness protections and move security-critical decisions into the write transaction where needed.

### B. Governance and legal onboarding
- Review queue reads, legal verification and hierarchy approvals use a distinct reviewer/jurisdiction authority model.
- Authority pre-checks occur outside some write transactions; revalidate reviewer authority, jurisdiction, evidence and dual-control separation on the same transaction client that records the decision.
- Keep legal verification, platform approval and organization operational activation as distinct states.

### C. Platform administration
- The protected `GET /api/v1/admin/database-runtime-identity` diagnostic exists on this candidate branch and returns only role identity/boolean privilege facts. It is not on deployed main and has not identified the live role.
- Platform admin has separate audited writes and direct reads. Revalidate Super Admin authority and privilege inside the same transaction for sensitive mutations. A broad RLS bypass role is not an acceptable shortcut.

### D. Intelligence and shared server reads
- `GET /api/v1/workspaces/intelligence` uses pool-level permission checks, optional geography check and data projection; move all three into one explicit read transaction.
- `GET /api/v1/overview` derives allowed organization IDs and then performs pool-level counts. Decide whether this is a deliberate multi-organization aggregate. If yes, define a verified set-valued context/policy contract; do not silently choose one active organization.
- Geography roots/children combine global reference rows and organization scopes. Children currently check access and read rows through separate pool operations; combine check and read in one transaction.
- `GET /api/v1/regulatory/sources` is a global reference read, not tenant-owned CRUD; protect source provenance/version integrity separately.

### E. Field-device sync
- Manual client transactions already bind device, identity, organization, cursor, idempotency key and payload processing for important paths.
- This is not the same principal as a human tenant session. Create a device-specific transaction context and table policy class; ensure the device cannot select/expand its own organization scope from submitted payload.
- Direct device inventory reads must enforce the exact allowed organization set and permission, not only a broad membership existence test.

### F. Registry and settlement
- The local registry transaction helper does not set tenant GUC context. Preserve its current row locks and in-transaction checks while designing explicit issuer/current-owner, payer, payee, actor and lifecycle rules.
- A generic policy based only on `organization_id` would be wrong for bilateral settlement and transferable credentials.

### G. MRV
- MRV uses a separate session-level advisory-lock client plus tenant transactions for data preflight/persistence. Confirm lock key uniqueness, timeout, release on all error paths and pool exhaustion behavior.
- External Guardian/Hedera submission and ambiguous timeout reconciliation remain separate gates; transaction context does not prove external consensus.

## 6. Worker, migration and seed identities

- API runtime: `server.ts` creates one Pool from `DATABASE_URL`.
- Migration runner: `migrate.ts` creates a separate pool but also reads `DATABASE_URL`. A separate pool/process is NOT a separate database principal. Migration credentials must be split before production role hardening.
- Government inbox worker runner: `async-mirror-worker-runner.ts` requires `GOVERNMENT_INBOX_DATABASE_URL`, deliberately has no `DATABASE_URL` fallback, rejects an identical database principal when both URLs are supplied, and checks schema readiness before queue operations.
- Worker implementation: `async-mirror-worker.ts`; there is no `government-inbox-worker.ts` file in the current tree. Use the actual module names.
- Render manifest currently declares one web service and `DATABASE_URL`; no worker service or `GOVERNMENT_INBOX_DATABASE_URL` is declared. Docker CMD starts only `production-server.js`. Therefore the worker is not shown as deployed/activated by this configuration.
- Acceptance seed and integration test pools use `DATABASE_URL` in test tooling; preserve strict production guards and disposable database targeting. Never share seed credentials with production API.

## 7. Statutory and domain correctness findings

- `statutory-routes.ts` now uses tenant transactions, but BWG assessment still persists fixed thresholds (20,000 sq m, 40,000 LPD, 100 kg/day) and the rule reference `SWM_RULES_2026_S_O_388_E`. This must be verified against the exact applicable current legal instrument, stakeholder category, effective date, amendment and approved rule snapshot before the result can drive a statutory determination.
- Current route response boundaries correctly describe internal applicability preparation and user-reported external registration as unverified. Preserve this distinction.
- A tenant transaction is not a substitute for source provenance, statutory approval, evidence review or regulator acknowledgement.

## 8. RLS and DB role decision — unchanged

Prior read-only Neon catalog evidence remains: no RLS enabled and no policies on inspected public tables. The observed Neon inspection role had elevated attributes; this is not evidence of the Render service's actual principal.

**Do not enable RLS yet.** Required before policy migration:
1. Safely observe actual Render `session_user` / `current_user` and role flags using reviewed diagnostic code and approved release, without exposing secrets.
2. Inventory table owners, grants, role memberships, sequences, functions, views, triggers and SECURITY DEFINER functions.
3. Complete statement-level mapping for every active route, auth/governance path, worker, migration, seed, CLI and operational tool.
4. Implement distinct API, identity/control-plane, platform-admin, worker, migration-owner, device and read-only operations identities as justified by actual trust boundaries.
5. Design table-specific SELECT/INSERT/UPDATE/DELETE policies and context contracts; no blanket enablement.
6. Run positive and negative cross-tenant, multi-org, bilateral settlement, device spoof/replay, worker isolation, pool context reuse and revoked-membership tests on a production-shaped disposable clone using the exact non-owner role.
7. Independent review, backup/restore and rollback rehearsal, explicit approval and change window.

## 9. Next execution batch

1. Complete statement-level review of `server.ts` overview/geography and `intelligence-routes.ts`; decide multi-organization aggregate semantics.
2. Complete identity/auth and onboarding race/authority transaction review.
3. Complete platform-admin transaction-level authorization revalidation review.
4. Complete device-principal sync design and tests.
5. Complete registry/settlement policy model and MRV advisory-lock behavior review.
6. Build the authoritative role/connection map from current deployment and source. Do not inspect or print secret environment values.
7. Produce the complete table-by-table RLS policy/test matrix only after the preceding contexts are resolved.

**Release posture:** P1 HOLD. RLS not implemented. Actual Render DB role not verified. Worker not activated. No production DB changes or deploys. TRL 9 not established.
