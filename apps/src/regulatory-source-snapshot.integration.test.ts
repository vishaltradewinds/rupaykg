import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

test("approved source snapshots are immutable and regulatory rules reject unsupported source scope", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex").toUpperCase();
  let identityId = "";
  const snapshotIds: string[] = [];
  const ruleIds: string[] = [];
  try {
    const identity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      [`test-source-reviewer:${suffix}`, `Source Reviewer ${suffix}`],
    );
    identityId = identity.rows[0]!.id;

    const insertSnapshot = async (scopeKind: "INDIA" | "STATE_UT", scopeCode: string | null) => {
      const result = await pool.query<{ id: string }>(
        `insert into authoritative_source_snapshots(
          source_owner,dataset_code,source_url,source_version,scope_kind,scope_code,
          retrieved_at,effective_from,content_sha256,record_count,accepted_record_count,
          unresolved_record_count,validation_status,usage_terms_reference,
          retrieved_by_identity_id,reviewed_by_identity_id,reviewed_at,notes
        ) values ($1,$2,$3,$4,$5,$6,now(),date '2026-01-01',$7,10,9,1,'APPROVED',
          'disposable-test-terms',$8,$8,now(),'Synthetic integration fixture only')
        returning id`,
        [
          "Disposable integration test source",
          `TEST-${suffix}-${scopeKind}-${scopeCode ?? "NATIONAL"}`,
          "https://example.invalid/test-source",
          `fixture-${suffix}`,
          scopeKind,
          scopeCode,
          sha(`fixture-content-${suffix}-${scopeKind}-${scopeCode ?? "NATIONAL"}`),
          identityId,
        ],
      );
      const id = result.rows[0]!.id;
      snapshotIds.push(id);
      return id;
    };

    const nationalSnapshotId = await insertSnapshot("INDIA", null);
    const stateSnapshotId = await insertSnapshot("STATE_UT", "MP");

    const insertRule = async (snapshotId: string, jurisdictionKind: "DISTRICT" | "STATE_UT", jurisdictionCode: string) => {
      const result = await pool.query<{ id: string }>(
        `insert into regulatory_rule_versions(
          framework,rule_reference,stakeholder_class,scheme_code,jurisdiction_scope_kind,
          jurisdiction_scope_code,source_snapshot_id,version_label,effective_from,
          rule_payload,status,reviewed_by_identity_id,reviewed_at,notes
        ) values ('TEST-FRAMEWORK',$1,'TEST-STAKEHOLDER','TEST-SCHEME',$2,$3,$4,
          'fixture-v1',date '2026-01-01','{"testFixture":true}'::jsonb,'APPROVED',$5,now(),
          'Synthetic integration fixture only') returning id`,
        [`TEST-RULE-${suffix}-${jurisdictionCode}`, jurisdictionKind, jurisdictionCode, snapshotId, identityId],
      );
      ruleIds.push(result.rows[0]!.id);
      return result.rows[0]!.id;
    };

    await insertRule(nationalSnapshotId, "DISTRICT", "BPL");
    await assert.rejects(
      insertRule(stateSnapshotId, "DISTRICT", "BPL"),
      /REGULATORY_RULE_SOURCE_SCOPE_MISMATCH/,
      "a state-only source must not silently support a district-level rule",
    );

    await assert.rejects(
      pool.query("update authoritative_source_snapshots set content_sha256=$2 where id=$1", [nationalSnapshotId, sha("tampered-content")]),
      /APPROVED_SOURCE_SNAPSHOT_PROVENANCE_IMMUTABLE/,
      "approved source content hash must not be rewritten",
    );
    await assert.rejects(
      pool.query("update authoritative_source_snapshots set authority_code='OTHER-AUTHORITY' where id=$1", [nationalSnapshotId]),
      /APPROVED_SOURCE_SNAPSHOT_PROVENANCE_IMMUTABLE/,
      "approved source authority identity must not be rewritten",
    );

    await pool.query("update authoritative_source_snapshots set validation_status='RETIRED' where id=$1", [nationalSnapshotId]);
    await assert.rejects(
      pool.query("update authoritative_source_snapshots set content_sha256=$2 where id=$1", [nationalSnapshotId, sha("tampered-after-retirement")]),
      /APPROVED_SOURCE_SNAPSHOT_PROVENANCE_IMMUTABLE/,
      "retired source provenance must remain immutable",
    );
    await assert.rejects(
      pool.query("update authoritative_source_snapshots set validation_status='APPROVED' where id=$1", [nationalSnapshotId]),
      /RETIRED_SOURCE_SNAPSHOT_STATUS_IMMUTABLE/,
      "retired snapshots must not be revived; corrected source data needs a new version",
    );
    await assert.rejects(
      pool.query("update authoritative_source_snapshots set validation_status='REJECTED' where id=$1", [nationalSnapshotId]),
      /RETIRED_SOURCE_SNAPSHOT_STATUS_IMMUTABLE/,
      "retirement must be terminal; changing to another status must not permit later re-approval",
    );
  } finally {
    if (ruleIds.length) await pool.query("delete from regulatory_rule_versions where id = any($1::uuid[])", [ruleIds]);
    if (snapshotIds.length) await pool.query("delete from authoritative_source_snapshots where id = any($1::uuid[])", [snapshotIds]);
    if (identityId) await pool.query("delete from identities where id=$1", [identityId]);
    await pool.end();
  }
});
