import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { createSignedRequestContextToken } from "./signed-request-context-token.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("EPR returns RLS isolates two organizations and fails closed without a valid signed context", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const secret = "ci-epr-tenant-rls-secret-material-at-least-32-bytes";
  const keyId = "epr_ci";
  const actorId = "d1000000-0000-4000-8000-000000000001";
  const organizationA = "d2000000-0000-4000-8000-000000000001";
  const organizationB = "d2000000-0000-4000-8000-000000000002";
  const returnA = "d3000000-0000-4000-8000-000000000001";
  const returnB = "d3000000-0000-4000-8000-000000000002";

  try {
    await client.query("BEGIN");
    await client.query(
      `insert into app_security.request_context_keys(key_id,secret,active)
       values($1,$2,true)
       on conflict(key_id) do update set secret=excluded.secret,active=true`,
      [keyId, secret],
    );
    await client.query(
      `insert into public.organizations(id,name,organization_type)
       values($1,'EPR RLS CI Tenant A','PRODUCER'),($2,'EPR RLS CI Tenant B','PRODUCER')
       on conflict(id) do nothing`,
      [organizationA, organizationB],
    );
    const scheme = await client.query<{ id: string }>(
      "select id from public.epr_schemes where code='PLASTIC_PACKAGING' and status='VERIFIED' limit 1",
    );
    assert.ok(scheme.rows[0]?.id, "verified PLASTIC_PACKAGING scheme fixture must exist");
    await client.query(
      `insert into public.epr_returns(id,scheme_id,organization_id,period_start,period_end,return_type,reported_quantity)
       values
         ($1,$3,$4,date '2098-01-01',date '2098-12-31','ANNUAL',10),
         ($2,$3,$5,date '2098-01-01',date '2098-12-31','ANNUAL',20)
       on conflict(id) do nothing`,
      [returnA, returnB, scheme.rows[0]!.id, organizationA, organizationB],
    );

    await client.query("SET LOCAL ROLE rupaykg_app_runtime");
    const tokenA = createSignedRequestContextToken(
      { actorIdentityId: actorId, organizationId: organizationA },
      { secret, keyId, ttlSeconds: 60 },
    );
    await client.query("select set_config('app.request_context',$1,true)", [tokenA]);
    const visibleA = await client.query<{ id: string; organization_id: string }>(
      "select id,organization_id from public.epr_returns where id = any($1::uuid[]) order by id",
      [[returnA, returnB]],
    );
    assert.deepEqual(visibleA.rows.map((row) => row.id), [returnA]);
    assert.ok(visibleA.rows.every((row) => row.organization_id === organizationA));

    const tokenB = createSignedRequestContextToken(
      { actorIdentityId: actorId, organizationId: organizationB },
      { secret, keyId, ttlSeconds: 60 },
    );
    await client.query("select set_config('app.request_context',$1,true)", [tokenB]);
    const visibleB = await client.query<{ id: string; organization_id: string }>(
      "select id,organization_id from public.epr_returns where id = any($1::uuid[]) order by id",
      [[returnA, returnB]],
    );
    assert.deepEqual(visibleB.rows.map((row) => row.id), [returnB]);
    assert.ok(visibleB.rows.every((row) => row.organization_id === organizationB));

    await client.query("select set_config('app.request_context','',true)");
    const withoutContext = await client.query<{ count: string }>(
      "select count(*)::text as count from public.epr_returns where id = any($1::uuid[])",
      [[returnA, returnB]],
    );
    assert.equal(withoutContext.rows[0]?.count, "0");

    await client.query("select set_config('app.request_context',$1,true)", ["forged.context"]);
    const forged = await client.query<{ count: string }>(
      "select count(*)::text as count from public.epr_returns where id = any($1::uuid[])",
      [[returnA, returnB]],
    );
    assert.equal(forged.rows[0]?.count, "0");
    await client.query("ROLLBACK");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
