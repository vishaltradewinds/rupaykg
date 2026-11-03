import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(file, import.meta.url), "utf8");
const fail = (message) => { throw new Error(`MRV worker contract validation failed: ${message}`); };

const server = await read("../apps/src/mrv-worker-server-restricted.ts");
const acceptance = await read("../tests/postgres/mrv-worker-api-boundary.acceptance.sql");
const worker = await read("../apps/src/mrv-submission-jobs.ts");
const claimIndex = await read("../migrations/20261113_mrv_worker_claim_index_reconcile.sql");
const provenance = await read("../migrations/015_guardian_hedera_mrv.sql");
const mirrorGate = await read("../migrations/083_mrv_mirror_node_registry_gate.sql");
const restrictedWorker = await read("../apps/src/mrv-submission-worker-restricted.ts");
const adapter = await read("../apps/src/mrv-worker-database-api.ts");

const protectedTables = [
  "organizations", "identities", "organization_memberships", "roles", "activities",
  "evidence", "verifications", "geography", "organization_geography_scopes",
  "mrv_observations", "measurements", "mrv_submission_jobs",
  "mrv_submission_job_events", "mrv_provenance_events",
];

const requiredList = server.match(/const requiredTables\s*=\s*\[([\s\S]*?)\];/);
if (!requiredList) fail("restricted server must declare requiredTables");
for (const table of protectedTables) {
  const literal = new RegExp("[\\\"']" + table + "[\\\"']");
  if (!literal.test(requiredList[1])) fail(`runtime preflight omits public.${table}`);
  if (!literal.test(acceptance)) fail(`PostgreSQL acceptance omits public.${table}`);
}

const statusesBlock = worker.match(/const claimableStatuses\s*:\s*MrvJobStatus\[\]\s*=\s*\[([\s\S]*?)\];/);
const indexPredicate = claimIndex.match(/where\s+status\s+in\s*\(([\s\S]*?)\);/i);
if (!statusesBlock || !indexPredicate) fail("worker status allow-list and partial index predicate must both be explicit");
const workerStatuses = [...statusesBlock[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]).sort();
const indexedStatuses = [...indexPredicate[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();
if (JSON.stringify(workerStatuses) !== JSON.stringify(indexedStatuses)) fail("claim index statuses differ from worker allow-list");
if (!/on\s+mrv_submission_jobs\s*\(next_attempt_at,\s*created_at,\s*id\)/i.test(claimIndex)) fail("claim index ordering must be next_attempt_at, created_at, id");
if (indexedStatuses.includes("NEEDS_RECONCILIATION")) fail("quarantined jobs must not be automatically claimable");

for (const column of ["activity_id", "verification_id", "evidence_id", "guardian_execution_id", "hcs_topic_id", "hcs_transaction_id", "hcs_consensus_timestamp", "integrity_hash"]) {
  if (!new RegExp("\\b" + column + "\\b").test(provenance)) fail(`provenance schema missing ${column}`);
}
if (!/mirror_node_verified_at\s+timestamptz/i.test(mirrorGate)) fail("Mirror Node verification timestamp must be persisted");
if (!/new\.integrity_hash[\s\S]*old\.integrity_hash/.test(mirrorGate)) fail("Mirror verification must be invalidated when the anchor digest changes");
if (!/mirror_verification_digest/.test(restrictedWorker) || !/database\.finalize\(job\.id,\s*lease\.leaseToken,\s*digest\)/.test(restrictedWorker)) fail("worker must pass the recomputed digest with the current lease");
if (!/mrv_worker_api\.finalize_provenance\(\$1::uuid,\$2::uuid,\$3\)/.test(adapter)) fail("adapter must call only the restricted finalization function");

console.log(`Validated ${protectedTables.length} protected relations, ${workerStatuses.length} claim statuses, deterministic claim index and provenance/Mirror finalization contract.`);
