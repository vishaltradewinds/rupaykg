# RupayKg CTO session log — MRV source snapshot revalidation

Date: 2026-11-02
Canonical repository: vishaltradewinds/rupaykg
Governing framework: Shakti Standards

## 18:01 UTC — source snapshot revalidation and deterministic parity repair

### Discovery
- Inspected exact-head CI runs after adding worker-side source snapshot revalidation.
- Run 41496015060 failed at the first valid-job authorization assertion. The failure was traced to the test fixture: it enqueued empty observations/evidence and omitted measurement quantity/unit, although live database rows existed.
- Confirmed the production API enqueue path includes those source rows and values. The worker's rejection was the correct fail-closed behavior; the fixture was incomplete.

### Implementation
- Corrected the disposable MRV job fixture to query the same observation rows, evidence rows and latest measurement quantity/unit as the API enqueue path.
- Aligned deterministic ordering across worker revalidation, API enqueue, direct preflight/re-read and the integration fixture by adding row ID as the tie-breaker after timestamps.
- The source revalidation tests now cover changed measurement quantity and changed evidence content hash, and verify that exact restoration returns the authorization check to true.
- The synchronous MRV route gate tests were added in apps/src/mrv-routes.test.ts and passed in exact-head run 41495848722.
- The NEEDS_RECONCILIATION non-claimable regression passed in exact-head run 41495699292.
- The worker restricted database contract is documented, but direct SQL remains in the worker and no worker role/functions/policies have been implemented.

### CI
- Exact-head CI 41495348937 completed SUCCESS on the heartbeat/direct-submit code head.
- Exact-head CI 41495848722 completed SUCCESS for direct-submit default-off and worker mutual-exclusion tests.
- Exact-head CI 41495699292 completed SUCCESS for NEEDS_RECONCILIATION claim exclusion.
- Exact-head CI 41495765539 completed SUCCESS for the worker contract documentation.
- Runs 41496015060, 41496118629 and 41496146332 failed at the incomplete snapshot fixture assertion; no production code weakening was made.
- Current exact-head CI 41496454924 for 4781bfe03ac68bf61031b9c2e8924dcd498d259e was in progress at TypeScript typecheck at 18:01 UTC. Do not claim the new snapshot tests pass until it completes.

### Safety
- No production Neon DDL/DML, migrations, roles/grants/RLS changes, branch operations, secret provisioning, deployments, provider writes, worker/scheduler activation, statutory submissions or certification.
- Production remains HOLD, worker OFF, certification OFF, TRL 9 NOT ESTABLISHED.
- Issues #195 and #196 were updated with the latest P0/bootstrap and tenant-isolation evidence.
- PRs #205/#211/#212 remain closed unmerged; PR #213 is the only EPR read-only candidate and needs reconciliation to current #192.

## Next actions
1. Verify CI 41496454924 and fix any new failure without weakening snapshot validation.
2. Reconcile #192 with main and #213 with latest #192.
3. Implement the narrow worker database function API and prove two-tenant, lease-loss and retry/reconciliation behavior.
4. Continue complete route-to-data and 67-table RLS assurance on disposable PostgreSQL only.
