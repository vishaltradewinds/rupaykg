import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 2 }) : null;
const suffix = randomUUID();
let sourceId = "";
let firstGeographyId = "";
let secondGeographyId = "";
let reviewerId = "";

before(async () => {
  if (!pool) return;
  sourceId = (await pool.query<{ id: string }>(
    "insert into geography_sources(source_name,source_version,source_uri,checksum,status) values($1,$2,$3,$4,'VERIFIED') returning id",
    [`geography-alias-test-${suffix}`, "v1", "https://example.invalid/test-fixture", "fixture-source-checksum"],
  )).rows[0]!.id;
  firstGeographyId = (await pool.query<{ id: string }>(
    "insert into geography(kind,code,name,source,source_version) values('DISTRICT',$1,$2,'test-fixture','v1') returning id",
    [`GEO-ALIAS-A-${suffix}`, `Alias Test Geography A ${suffix}`],
  )).rows[0]!.id;
  secondGeographyId = (await pool.query<{ id: string }>(
    "insert into geography(kind,code,name,source,source_version) values('DISTRICT',$1,$2,'test-fixture','v1') returning id",
    [`GEO-ALIAS-B-${suffix}`, `Alias Test Geography B ${suffix}`],
  )).rows[0]!.id;
  reviewerId = (await pool.query<{ id: string }>(
    "insert into identities(external_subject,display_name) values($1,$2) returning id",
    [`geography-alias-reviewer-${suffix}`, "Geography Alias Test Reviewer"],
  )).rows[0]!.id;
});

after(async () => {
  if (!pool) return;
  await pool.query("delete from geography_external_identifiers where source_id=$1", [sourceId]);
  await pool.query("delete from geography where id = any($1::uuid[])", [[firstGeographyId, secondGeographyId].filter(Boolean)]);
  if (sourceId) await pool.query("delete from geography_sources where id=$1", [sourceId]);
  if (reviewerId) await pool.query("delete from identities where id=$1", [reviewerId]);
  await pool.end();
});

describe("versioned geography external identifier registry", () => {
  it("requires reviewer and source checksum provenance for verified mappings", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(
        "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,status) values($1,$2,'LGD_CODE',$3,'2025-01-01','VERIFIED')",
        [sourceId, firstGeographyId, `ALIAS-${suffix}`],
      ),
      /check constraint/,
    );
  });

  it("resolves only an exact verified alias for its source and effective date", async () => {
    if (!pool) return;
    const alias = `RESOLVE-${suffix}`;
    const first = (await pool.query<{ id: string }>(
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,valid_to,status,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2025-01-01','2025-12-31','VERIFIED',$4,$5,now()) returning id",
      [sourceId, firstGeographyId, alias, "d".repeat(64), reviewerId],
    )).rows[0]!.id;
    const second = (await pool.query<{ id: string }>(
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,status,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2026-01-01','VERIFIED',$4,$5,now()) returning id",
      [sourceId, secondGeographyId, alias, "e".repeat(64), reviewerId],
    )).rows[0]!.id;
    const old = await pool.query<{ geography_id: string | null }>(
      "select resolve_verified_geography_external_identifier($1,'LGD_CODE',$2,'2025-06-01') as geography_id",
      [sourceId, alias],
    );
    assert.equal(old.rows[0]?.geography_id, firstGeographyId);
    const current = await pool.query<{ geography_id: string | null }>(
      "select resolve_verified_geography_external_identifier($1,'LGD_CODE',$2,'2026-02-01') as geography_id",
      [sourceId, alias],
    );
    assert.equal(current.rows[0]?.geography_id, secondGeographyId);
    const wrongSource = await pool.query<{ geography_id: string | null }>(
      "select resolve_verified_geography_external_identifier($1,'LGD_CODE',$2,'2026-02-01') as geography_id",
      [randomUUID(), alias],
    );
    assert.equal(wrongSource.rows[0]?.geography_id, null);
    await pool.query("update geography_external_identifiers set status='RETIRED' where id=$1", [second]);
    const retired = await pool.query<{ geography_id: string | null }>(
      "select resolve_verified_geography_external_identifier($1,'LGD_CODE',$2,'2026-02-01') as geography_id",
      [sourceId, alias],
    );
    assert.equal(retired.rows[0]?.geography_id, null);
  });

  it("rejects overlapping verified periods but accepts a subsequent non-overlapping version", async () => {
    if (!pool) return;
    const alias = `ALIAS-${suffix}`;
    await pool.query(
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,valid_to,status,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2025-01-01','2025-12-31','VERIFIED',$4,$5,now())",
      [sourceId, firstGeographyId, alias, "a".repeat(64), reviewerId],
    );
    await assert.rejects(
      pool.query(
        "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,valid_to,status,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2025-12-01','2026-01-31','VERIFIED',$4,$5,now())",
        [sourceId, secondGeographyId, alias, "b".repeat(64), reviewerId],
      ),
      /geography_external_identifier_effective_period_excl/,
    );
    const next = await pool.query<{ id: string }>(
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,status,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2026-01-01','VERIFIED',$4,$5,now()) returning id",
      [sourceId, secondGeographyId, alias, "c".repeat(64), reviewerId],
    );
    assert.ok(next.rows[0]?.id);
  });
});
