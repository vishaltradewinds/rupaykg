import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const existingPath = (candidates: string[]): string => {
  const found = candidates
    .map((candidate) => fileURLToPath(new URL(candidate, import.meta.url)))
    .find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Required contract source file not found: ${candidates.join(", ")}`);
  return found;
};
const crosswalkRouteSource = readFileSync(
  existingPath(["../src/government-jurisdiction-crosswalk-routes.ts", "../../src/government-jurisdiction-crosswalk-routes.ts"]),
  "utf8",
);
const migrationSql = readFileSync(
  existingPath(["../../migrations/20261112_geography_external_identifiers.sql", "../../../migrations/20261112_geography_external_identifiers.sql"]),
  "utf8",
);

describe("geography alias migration contract (database-independent)", () => {
  it("keeps the migration structurally complete and provenance-gated", () => {
    assert.equal((migrationSql.match(/\$\$/g) ?? []).length, 4, "expected exactly two complete function bodies");
    assert.equal((migrationSql.match(/create or replace function guard_geography_external_identifier_lifecycle/g) ?? []).length, 1, "lifecycle guard must be defined once");
    assert.equal((migrationSql.match(/create or replace function resolve_verified_geography_external_identifier/g) ?? []).length, 1, "resolver must be defined once");
    assert.match(migrationSql, /source_reference_uri is not null/);
    assert.ok(migrationSql.includes("source_checksum ~ '^[0-9a-f]{64}$'"));
    assert.match(migrationSql, /exclude using gist/i);
    assert.match(migrationSql, /status = 'VERIFIED'/);
    assert.match(migrationSql, /GEOGRAPHY_EXTERNAL_IDENTIFIER_VERIFIED_IMMUTABLE/);
    assert.match(migrationSql, /GEOGRAPHY_EXTERNAL_IDENTIFIER_RETIRED_TERMINAL/);
    assert.match(migrationSql, /resolve_verified_geography_external_identifier/);
  });
});

describe("government crosswalk geography resolver integration contract", () => {
  it("binds optional external identifiers to the exact approved source snapshot and canonical geography", () => {
    assert.ok(crosswalkRouteSource.includes("externalIdentifierType"));
    assert.ok(crosswalkRouteSource.includes("body.externalIdentifierType !== undefined && body.externalIdentifierType !== null && externalIdentifierType === null"));
    assert.ok(crosswalkRouteSource.includes("gs.source_uri = snap.source_url"));
    assert.ok(crosswalkRouteSource.includes("gs.source_version = snap.source_version"));
    assert.ok(crosswalkRouteSource.includes("gs.checksum = snap.content_sha256"));
    assert.ok(crosswalkRouteSource.includes("resolve_verified_geography_external_identifier"));
    assert.ok(crosswalkRouteSource.includes("GEOGRAPHY_SOURCE_SNAPSHOT_BINDING_REQUIRED"));
    assert.ok(crosswalkRouteSource.includes("GEOGRAPHY_EXTERNAL_IDENTIFIER_MISMATCH"));
    assert.ok(crosswalkRouteSource.includes("const requestHash = digest({"));
    assert.ok(crosswalkRouteSource.includes("source.rows.length !== 1"));
    assert.ok(crosswalkRouteSource.includes("snap.content_sha256 ~ '^[0-9a-f]{64}$'"));
  });
});

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
  if (sourceId) await pool.query("delete from geography_external_identifiers where source_id=$1", [sourceId]);
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
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,valid_to,status,source_reference_uri,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2025-01-01','2025-12-31','VERIFIED','https://example.invalid/alias-source',$4,$5,now()) returning id",
      [sourceId, firstGeographyId, alias, "d".repeat(64), reviewerId],
    )).rows[0]!.id;
    const second = (await pool.query<{ id: string }>(
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,status,source_reference_uri,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2026-01-01','VERIFIED','https://example.invalid/alias-source',$4,$5,now()) returning id",
      [sourceId, secondGeographyId, alias, "e".repeat(64), reviewerId],
    )).rows[0]!.id;
    const old = await pool.query<{ geography_id: string | null }>(
      "select resolve_verified_geography_external_identifier($1,'LGD_CODE',$2,'2025-06-01') as geography_id",
      [sourceId, alias],
    );
    assert.equal(old.rows[0]?.geography_id, firstGeographyId);
    await assert.rejects(
      pool.query("update geography_external_identifiers set geography_id=$1 where id=$2", [secondGeographyId, first]),
      /GEOGRAPHY_EXTERNAL_IDENTIFIER_VERIFIED_IMMUTABLE/,
    );
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
    await assert.rejects(
      pool.query("update geography_external_identifiers set status='VERIFIED' where id=$1", [second]),
      /GEOGRAPHY_EXTERNAL_IDENTIFIER_RETIRED_TERMINAL/,
    );
  });

  it("rejects overlapping verified periods but accepts a subsequent non-overlapping version", async () => {
    if (!pool) return;
    const alias = `ALIAS-${suffix}`;
    await pool.query(
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,valid_to,status,source_reference_uri,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2025-01-01','2025-12-31','VERIFIED','https://example.invalid/alias-source',$4,$5,now())",
      [sourceId, firstGeographyId, alias, "a".repeat(64), reviewerId],
    );
    await assert.rejects(
      pool.query(
        "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,valid_to,status,source_reference_uri,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2025-12-01','2026-01-31','VERIFIED','https://example.invalid/alias-source',$4,$5,now())",
        [sourceId, secondGeographyId, alias, "b".repeat(64), reviewerId],
      ),
      /geography_external_identifier_effective_period_excl/,
    );
    const next = await pool.query<{ id: string }>(
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,status,source_reference_uri,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2026-01-01','VERIFIED','https://example.invalid/alias-source',$4,$5,now()) returning id",
      [sourceId, secondGeographyId, alias, "c".repeat(64), reviewerId],
    );
    assert.ok(next.rows[0]?.id);
  });
});
