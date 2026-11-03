import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerEprReturnReadRoute } from "./epr-return-read-route.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("Fastify EPR read route authorizes through the exact restricted runtime and signed tenant transaction", { skip: !enabled }, async () => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const runtime = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    options: "-c role=rupaykg_app_runtime",
  });
  const app = Fastify();
  const suffix = randomBytes(8).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const keyId = "eprrt_" + suffix;
  const identityId = randomUUID();
  const deniedIdentityId = randomUUID();
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const returnA = randomUUID();
  const returnB = randomUUID();
  const bearerA = "epr-route-reader-" + suffix;
  const bearerDenied = "epr-route-denied-" + suffix;
  const tokenHashA = createHash("sha256").update(bearerA).digest("hex");
  const tokenHashDenied = createHash("sha256").update(bearerDenied).digest("hex");
  let fixturesCreated = false;

  try {
    const scheme = await admin.query<{ id: string }>(
      "select id from public.epr_schemes where code='PLASTIC_PACKAGING' and status='VERIFIED' limit 1",
    );
    assert.ok(scheme.rows[0]?.id, "verified PLASTIC_PACKAGING scheme fixture must exist");

    await admin.query(
      "insert into public.organizations(id,name,organization_type,status) values($1,$2,'PRODUCER','VERIFIED'),($3,$4,'PRODUCER','VERIFIED')",
      [organizationA, "EPR route tenant A " + suffix, organizationB, "EPR route tenant B " + suffix],
    );
    await admin.query(
      "insert into public.identities(id,external_subject,display_name,status) values($1,$2,'EPR Route Reader','VERIFIED'),($3,$4,'EPR Route Denied','VERIFIED')",
      [identityId, "epr-route-reader:" + suffix, deniedIdentityId, "epr-route-denied:" + suffix],
    );
    await admin.query(
      "update public.organizations set verification_status='VERIFIED',verified_by_identity_id=$2,verified_at=clock_timestamp() where id=$1",
      [organizationA, identityId],
    );
    await admin.query(
      "update public.organizations set verification_status='VERIFIED',verified_by_identity_id=$2,verified_at=clock_timestamp() where id=$1",
      [organizationB, identityId],
    );

    const roleReader = await admin.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions,geography_scope) values($1,'epr_route_reader_' || $2,'[\"epr:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA, suffix],
    );
    const roleDenied = await admin.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions,geography_scope) values($1,'epr_route_denied_' || $2,'[\"dashboard:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA, suffix],
    );

    await admin.query("ALTER TABLE public.organization_memberships DISABLE TRIGGER stakeholder_membership_application_guard");
    try {
      await admin.query(
        "insert into public.organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED')",
        [identityId, organizationA, roleReader.rows[0]!.id, deniedIdentityId, roleDenied.rows[0]!.id],
      );
    } finally {
      await admin.query("ALTER TABLE public.organization_memberships ENABLE TRIGGER stakeholder_membership_application_guard");
    }

    await admin.query(
      "insert into public.identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '5 minutes',$2),($3,now()+interval '5 minutes',$4)",
      [identityId, tokenHashA, deniedIdentityId, tokenHashDenied],
    );
    await admin.query(
      "insert into app_security.request_context_keys(key_id,secret,active) values($1,$2,true)",
      [keyId, secret],
    );
    await admin.query(
      "insert into public.epr_returns(id,scheme_id,organization_id,period_start,period_end,return_type,reported_quantity) values($1,$3,$4,date '2098-01-01',date '2098-12-31','ANNUAL',10),($2,$3,$5,date '2098-01-01',date '2098-12-31','ANNUAL',20)",
      [returnA, returnB, scheme.rows[0]!.id, organizationA, organizationB],
    );
    fixturesCreated = true;

    await registerEprReturnReadRoute(app, runtime, {
      hmacSecret: secret,
      keyId,
      ttlSeconds: 60,
    });

    const allowed = await app.inject({
      method: "GET",
      url: "/api/v1/epr/returns",
      headers: {
        authorization: "Bearer " + bearerA,
        "x-rupaykg-organization-id": organizationA,
      },
    });
    assert.equal(allowed.statusCode, 200, allowed.body);
    assert.deepEqual(allowed.json().returns.map((row: { id: string }) => row.id), [returnA]);

    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/epr/returns",
      headers: {
        authorization: "Bearer " + bearerDenied,
        "x-rupaykg-organization-id": organizationA,
      },
    });
    assert.equal(denied.statusCode, 403, denied.body);
    assert.equal(denied.json().code, "EPR_RETURN_READ_FORBIDDEN");

    const crossTenant = await app.inject({
      method: "GET",
      url: "/api/v1/epr/returns",
      headers: {
        authorization: "Bearer " + bearerA,
        "x-rupaykg-organization-id": organizationB,
      },
    });
    assert.equal(crossTenant.statusCode, 401, crossTenant.body);
  } finally {
    await app.close();
    await runtime.end();
    if (fixturesCreated) {
      await admin.query("delete from public.epr_returns where id=any($1::uuid[])", [[returnA, returnB]]);
      await admin.query("delete from public.identity_sessions where token_hash=any($1::text[])", [[tokenHashA, tokenHashDenied]]);
      await admin.query("delete from app_security.request_context_keys where key_id=$1", [keyId]);
      await admin.query("delete from public.organization_memberships where identity_id=any($1::uuid[])", [[identityId, deniedIdentityId]]);
      await admin.query("delete from public.roles where id=any($1::uuid[])", [[/* role rows are scoped by unique fixture names below */]]);
      await admin.query("delete from public.roles where organization_id=$1 and name=any($2::text[])", [organizationA, ["epr_route_reader_" + suffix, "epr_route_denied_" + suffix]]);
      await admin.query("delete from public.identities where id=any($1::uuid[])", [[identityId, deniedIdentityId]]);
      await admin.query("delete from public.organizations where id=any($1::uuid[])", [[organizationA, organizationB]]);
    }
    await admin.end();
  }
});
