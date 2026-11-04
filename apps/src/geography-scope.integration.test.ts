import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("organization geography authorization fails closed without a verified root", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  try {
    const organizations = await Promise.all([
      pool.query<{ id: string }>(
        "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
        ["TEST-GEO-UNSCOPED-" + suffix],
      ),
      pool.query<{ id: string }>(
        "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
        ["TEST-GEO-PENDING-SCOPE-" + suffix],
      ),
      pool.query<{ id: string }>(
        "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
        ["TEST-GEO-VALID-SCOPE-" + suffix],
      ),
    ]);
    const unscopedOrg = organizations[0]!.rows[0]!.id;
    const pendingOrg = organizations[1]!.rows[0]!.id;
    const scopedOrg = organizations[2]!.rows[0]!.id;

    const root = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','fail-closed-v1') returning id",
      ["TEST-GEO-ROOT-" + suffix],
    );
    const descendant = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version,parent_id) values('DISTRICT',$1,'integration-test','fail-closed-v1',$2) returning id",
      ["TEST-GEO-DISTRICT-" + suffix, root.rows[0]!.id],
    );
    const foreign = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','fail-closed-v1') returning id",
      ["TEST-GEO-FOREIGN-" + suffix],
    );

    await pool.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'PENDING'),($3,$4,'VERIFIED')",
      [pendingOrg, root.rows[0]!.id, scopedOrg, root.rows[0]!.id],
    );

    const check = async (organizationId: string | null, geographyId: string | null) => {
      const result = await pool.query<{ allowed: boolean }>(
        "select public.organization_has_geography_scope($1::uuid,$2::uuid) as allowed",
        [organizationId, geographyId],
      );
      return result.rows[0]!.allowed;
    };

    assert.equal(await check(unscopedOrg, root.rows[0]!.id), false, "no scope rows must not authorize");
    assert.equal(await check(pendingOrg, root.rows[0]!.id), false, "pending scope must not authorize");
    assert.equal(await check(scopedOrg, root.rows[0]!.id), true, "verified root authorizes itself");
    assert.equal(await check(scopedOrg, descendant.rows[0]!.id), true, "verified root authorizes descendants");
    assert.equal(await check(scopedOrg, foreign.rows[0]!.id), false, "a different geography branch must be denied");
    assert.equal(await check(null, root.rows[0]!.id), false, "null organization must be denied");
    assert.equal(await check(scopedOrg, null), false, "null geography must be denied");
  } finally {
    await pool.end();
  }
});
