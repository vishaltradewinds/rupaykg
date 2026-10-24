import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const verifierSource = readFileSync(fileURLToPath(new URL("../../src/verify-audit-chain.ts", import.meta.url)), "utf8");

test("audit-chain verifier uses a repeatable-read read-only transaction", () => {
  assert.match(verifierSource, /begin transaction isolation level repeatable read read only/i);
  assert.match(verifierSource, /mode: "READ_ONLY"/);
  assert.match(verifierSource, /rejectUnauthorized: true/);
});

test("audit-chain verifier does not issue database mutations or migrations", () => {
  assert.doesNotMatch(verifierSource, /\b(?:insert\s+into|update\s+[a-z_]+\s+set|delete\s+from|create\s+table|alter\s+table|drop\s+table)\b/i);
  assert.doesNotMatch(verifierSource, /migrate\.ts/);
});
const auditChainMigration = readFileSync(fileURLToPath(new URL("../../../migrations/088_global_audit_chain_enforcement.sql", import.meta.url)), "utf8");

test("audit-chain cutover quiesces audit writers before taking the chain-head lock", () => {
  const auditLock = auditChainMigration.indexOf("lock table audit_events in share row exclusive mode;");
  const headLock = auditChainMigration.indexOf("lock table platform_audit_chain_head in exclusive mode;");
  assert.ok(auditLock >= 0, "migration must explicitly quiesce audit writes");
  assert.ok(headLock >= 0, "migration must explicitly lock the chain head");
  assert.ok(auditLock < headLock, "audit relation lock must precede head lock to avoid lock inversion with in-flight INSERT triggers");
});
const migrationVerifierSource = readFileSync(fileURLToPath(new URL("../../src/verify-migration-state.ts", import.meta.url)), "utf8");

test("migration-state verifier compares the full migration inventory in a read-only TLS-verified transaction", () => {
  assert.match(migrationVerifierSource, /begin transaction isolation level repeatable read read only/i);
  assert.match(migrationVerifierSource, /rejectUnauthorized: true/);
  assert.match(migrationVerifierSource, /const missing =/);
  assert.match(migrationVerifierSource, /const mismatched =/);
  assert.match(migrationVerifierSource, /const unexpected =/);
  assert.doesNotMatch(migrationVerifierSource, /\b(?:insert\s+into|update\s+[a-z_]+\s+set|delete\s+from|create\s+table|alter\s+table|drop\s+table)\b/i);
});

const runtimeRoleAuditMigration = readFileSync(fileURLToPath(new URL("../../../migrations/20261027_runtime_role_audit_chain_security_definer.sql", import.meta.url)), "utf8");
test("audit-chain trigger functions execute with a pinned privileged owner, not runtime table grants", () => {
  for (const functionName of [
    "chain_audit_event_before_insert",
    "chain_audit_event_after_insert",
    "reject_audit_event_mutation",
    "reject_audit_chain_anchor_mutation",
    "reject_audit_chain_head_removal",
  ]) {
    assert.match(runtimeRoleAuditMigration, new RegExp(`ALTER FUNCTION public\\.${functionName}\\(\\)[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = pg_catalog, public`, "i"));
  }
  assert.match(runtimeRoleAuditMigration, /REVOKE CREATE ON SCHEMA public FROM PUBLIC/i);
});
