import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migrationPath = fileURLToPath(new URL("../../../migrations/20261029_cpcb_swm_evidence_links.sql", import.meta.url));
const routePath = fileURLToPath(new URL("../../../apps/src/cpcb-swm-routes.ts", import.meta.url));

test("CPCB evidence links enforce tenant and artifact-version consistency in PostgreSQL", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
  assert.match(sql, /foreign key\s*\(workspace_id,\s*organization_id\)\s*references cpcb_swm_stakeholder_workspaces\(id,\s*organization_id\)/);
  assert.match(sql, /foreign key\s*\(artifact_version_id,\s*evidence_id\)\s*references evidence_artifact_versions\(id,\s*evidence_id\)/);
  assert.match(sql, /unique\s*\(workspace_id,\s*evidence_id,\s*checklist_key\)/);
  assert.match(sql, /before update or delete on cpcb_swm_workspace_evidence/);
  assert.match(sql, /raise exception 'cpcb evidence links are append-only/);
});

test("CPCB evidence-link API remains scoped and never claims official CPCB verification", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /initialSwmChecklist\(w\.stakeholder_type\)\.some\(x\s*=>\s*x\.key\s*===\s*checklistKey\)/);
  assert.match(source, /s\.organization_id=\$2 and a\.organization_id=\$2 and s\.activity_id=a\.id/);
  assert.match(source, /organization_has_geography_scope\(\$1::uuid,\$2::uuid\)/);
  assert.match(source, /officialCpcbStatus:"UNCHANGED"/);
  assert.match(source, /officialCpcbStatusChanged:false/);
  assert.match(source, /AUDIT_REQUEST_ID_REQUIRED/);
  assert.match(source, /writeAudit\(client,auth\.identityId,org,"CPCB_SWM_EVIDENCE_LINKED",link\.id,[\s\S]*?requestId\);/);
  assert.doesNotMatch(source, /request-id-unavailable/);
  assert.equal((source.match(/AUDIT_REQUEST_ID_REQUIRED/g) ?? []).length, 3, "create, update and evidence-link writes must fail closed without a request ID");
  assert.match(source, /where l\.workspace_id=\$1 and l\.organization_id=\$2/);
});
