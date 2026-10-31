import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";
import { bwgProfileReviewBasis, bwgEprQuantityError, canReadBwgWorkspace, isBwgApplicabilityNotVerifiedConflict, isBwgEprFulfilledObligationConstraintViolation } from "./value-routes.js";

test("BWG profile intake never self-asserts statutory applicability or external registration", () => {
  const basis = bwgProfileReviewBasis();
  assert.equal(basis.sourceRuleReference, "SWM_RULES_2026_S_O_388_E");
  assert.equal(basis.classification, "REVIEW_REQUIRED");
  assert.equal(basis.determinationBoundary, "PROFILE_INTAKE_ONLY_NOT_A_STATUTORY_DETERMINATION");
  assert.equal(basis.evidenceAndIndependentReviewRequired, true);
  assert.equal(basis.externalRegistrationAsserted, false);
});


test("BWG workspace read requires the explicit reports:read permission", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const auth = {
    identityId: "identity-1",
    memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
    activeOrganizationId: "org-1",
  };
  const client = {
    query: async (sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return { rows: [{ ok: true }] };
    },
  } as never;

  assert.equal(await canReadBwgWorkspace(client, auth, "org-1"), true);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0]!.values, ["identity-1", "org-1", ["reports:read"]]);
});

test("BWG workspace read fails closed when reports:read is absent or organization scope differs", async () => {
  let queryCount = 0;
  const auth = {
    identityId: "identity-1",
    memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
    activeOrganizationId: "org-1",
  };
  const deniedClient = {
    query: async () => { queryCount += 1; return { rows: [{ ok: false }] }; },
  } as never;

  assert.equal(await canReadBwgWorkspace(deniedClient, auth, "org-1"), false);
  assert.equal(await canReadBwgWorkspace(deniedClient, auth, "org-2"), false);
  assert.equal(queryCount, 1);
});

test("BWG EPR quantities reject fulfilled amounts above the obligation and accept exact boundaries", () => {
  assert.equal(bwgEprQuantityError(10, 0), null);
  assert.equal(bwgEprQuantityError(10, 10), null);
  assert.equal(bwgEprQuantityError(10, 10.01), "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED");
  assert.equal(bwgEprQuantityError(0, 0), null);
  assert.equal(bwgEprQuantityError(null, 0), "BWG_EPR_REQUIRED");
  assert.equal(bwgEprQuantityError(10, null), "BWG_EPR_REQUIRED");
  assert.equal(bwgEprQuantityError(-1, 0), "BWG_EPR_REQUIRED");
  assert.equal(bwgEprQuantityError(10, -1), "BWG_EPR_REQUIRED");
});

test("BWG EPR database conflict mapping is restricted to the exact production check constraint", () => {
  assert.equal(isBwgEprFulfilledObligationConstraintViolation({
    code: "23514",
    constraint: "bwg_epr_reports_fulfilled_le_obligated",
  }), true);
  assert.equal(isBwgEprFulfilledObligationConstraintViolation({
    code: "23514",
    constraint: "bwg_epr_reports_fulfilled_quantity_check",
  }), false);
  assert.equal(isBwgEprFulfilledObligationConstraintViolation({
    code: "23505",
    constraint: "bwg_epr_reports_fulfilled_le_obligated",
  }), false);
  assert.equal(isBwgEprFulfilledObligationConstraintViolation(null), false);
});

test("BWG reporting-period applicability conflict is mapped only for the exact live trigger error", () => {
  assert.equal(isBwgApplicabilityNotVerifiedConflict({
    code: "23514",
    message: "BWG applicability must be verified before creating a reporting period",
  }), true);
  assert.equal(isBwgApplicabilityNotVerifiedConflict({
    code: "23514",
    message: "a different check constraint failed",
  }), false);
  assert.equal(isBwgApplicabilityNotVerifiedConflict({
    code: "23505",
    message: "BWG applicability must be verified before creating a reporting period",
  }), false);
  assert.equal(isBwgApplicabilityNotVerifiedConflict(null), false);
});



const bwgTestIdentityId = "11111111-1111-4111-8111-111111111111";
const bwgTestOrganizationId = "22222222-2222-4222-8222-222222222222";

function authenticatedBwgTestPool(options: {
  permissionGranted?: boolean;
  eprInsertError?: unknown;
  periodInsertError?: unknown;
} = {}) {
  const statements: string[] = [];
  let connectCount = 0;
  const pool = {
    async query(sql: string) {
      if (sql.includes("from identity_sessions s")) return { rows: [{ identity_id: bwgTestIdentityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("status = 'VERIFIED'")) {
        return { rows: [{ organization_id: bwgTestOrganizationId, role_id: "bwg-test-role", status: "VERIFIED" }] };
      }
      throw new Error("Unexpected authentication query: " + sql);
    },
    async connect() {
      connectCount += 1;
      return {
        async query(sql: string) {
          statements.push(sql);
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.startsWith("select set_config")) return { rows: [] };
          if (sql.includes("join roles r")) return { rows: [{ ok: options.permissionGranted ?? true }] };
          if (sql.includes("select organization_id from bwg_reporting_periods")) return { rows: [{ organization_id: bwgTestOrganizationId }] };
          if (sql.includes("select id from epr_schemes")) return { rows: [{ id: "bwg-test-scheme" }] };
          if (sql.includes("insert into bwg_epr_reports")) {
            if (options.eprInsertError) throw options.eprInsertError;
            return { rows: [{ id: "bwg-test-epr-report" }] };
          }
          if (sql.includes("insert into bwg_reporting_periods")) {
            if (options.periodInsertError) throw options.periodInsertError;
            return { rows: [{ id: "bwg-test-period" }] };
          }
          throw new Error("Unexpected BWG transaction query: " + sql);
        },
        release() {},
      };
    },
  };
  return { pool: pool as unknown as Pool, statements, connectCount: () => connectCount };
}

test("BWG HTTP routes fail closed with 401 when no authenticated database session exists", async (t) => {
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, null);
  t.after(async () => app.close());

  const requests = [
    { method: "GET" as const, url: "/api/v1/workspaces/bwg" },
    { method: "POST" as const, url: "/api/v1/bwg/profile", payload: {} },
    { method: "POST" as const, url: "/api/v1/bwg/reporting-periods", payload: {} },
    { method: "POST" as const, url: "/api/v1/bwg/reporting-periods/00000000-0000-4000-8000-000000000001/waste", payload: {} },
    { method: "POST" as const, url: "/api/v1/bwg/reporting-periods/00000000-0000-4000-8000-000000000001/epr", payload: {} },
    { method: "POST" as const, url: "/api/v1/bwg/reporting-periods/00000000-0000-4000-8000-000000000001/esg", payload: {} },
  ];

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, request.method + " " + request.url + ": " + response.body);
    assert.equal(response.json().code, "AUTH_REQUIRED");
  }
});

test("BWG EPR HTTP route rejects fulfilled quantity above obligation before opening a database transaction", async (t) => {
  const fake = authenticatedBwgTestPool();
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, fake.pool);
  t.after(async () => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/bwg/reporting-periods/33333333-3333-4333-8333-333333333333/epr",
    headers: { authorization: "Bearer bwg-http-test-session" },
    payload: { schemeId: "bwg-test-scheme", categoryCode: "PLASTIC", obligatedQuantity: 10, fulfilledQuantity: 11 },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED");
  assert.equal(fake.connectCount(), 0, "invalid quantity must be rejected before any transaction or insert");
});

test("BWG EPR HTTP route maps only the exact production check-constraint failure to 409", async (t) => {
  const dbError = Object.assign(new Error("check constraint failed"), {
    code: "23514",
    constraint: "bwg_epr_reports_fulfilled_le_obligated",
  });
  const fake = authenticatedBwgTestPool({ eprInsertError: dbError });
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, fake.pool);
  t.after(async () => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/bwg/reporting-periods/33333333-3333-4333-8333-333333333333/epr",
    headers: { authorization: "Bearer bwg-http-test-session" },
    payload: { schemeId: "bwg-test-scheme", categoryCode: "PLASTIC", obligatedQuantity: 10, fulfilledQuantity: 9 },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED");
  assert.ok(fake.statements.includes("ROLLBACK"));
});

test("BWG reporting-period HTTP route maps the exact live applicability trigger rejection to 409", async (t) => {
  const triggerError = Object.assign(new Error("BWG applicability must be verified before creating a reporting period"), {
    code: "23514",
  });
  const fake = authenticatedBwgTestPool({ periodInsertError: triggerError });
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, fake.pool);
  t.after(async () => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/bwg/reporting-periods",
    headers: { authorization: "Bearer bwg-http-test-session" },
    payload: {
      organizationId: bwgTestOrganizationId,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      reportingBasis: "MONTHLY",
    },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "BWG_APPLICABILITY_NOT_VERIFIED");
  assert.ok(fake.statements.includes("ROLLBACK"));
});



const bwgDbAcceptanceEnabled = process.env.CI === "true"
  && process.env.NODE_ENV !== "production"
  && process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1"
  && Boolean(process.env.DATABASE_URL);

test("BWG authenticated HTTP authorization fails closed against disposable PostgreSQL", {
  skip: !bwgDbAcceptanceEnabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true },
    max: 4,
  });
  const fixtures: Array<{ identityId: string; organizationId: string; geographyId: string; tokenHash: string; extraGeographyIds?: string[]; periodIds?: string[]; schemeIds?: string[]; activityIds?: string[]; evidenceIds?: string[]; verificationIds?: string[]; verifierIdentityIds?: string[] }> = [];
  const makeFixture = async (permissions: string[], membershipStatus = "VERIFIED") => {
    const identityId = randomUUID();
    const organizationId = randomUUID();
    const geographyId = randomUUID();
    const roleId = randomUUID();
    const token = randomUUID() + randomUUID();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const suffix = randomUUID().replaceAll("-", "");

    await pool.query("insert into identities(id, display_name, status) values ($1,$2,'VERIFIED')", [identityId, "BWG HTTP acceptance " + suffix]);
    await pool.query("insert into organizations(id, name, organization_type, status) values ($1,$2,'ACCEPTANCE_TEST','VERIFIED')", [organizationId, "BWG HTTP acceptance " + suffix]);
    await pool.query("insert into roles(id, organization_id, name, permissions, geography_scope) values ($1,$2,$3,$4::jsonb,'[]'::jsonb)", [roleId, organizationId, "BWG HTTP acceptance " + suffix, JSON.stringify(permissions)]);
    await pool.query("insert into organization_memberships(identity_id, organization_id, role_id, status) values ($1,$2,$3,$4)", [identityId, organizationId, roleId, membershipStatus]);
    await pool.query("insert into geography(id, kind, code, name, source, source_version) values ($1,'CLUSTER',$2,$3,'RupayKG disposable BWG HTTP fixture','v1')", [geographyId, "BWG-HTTP-" + suffix, "BWG HTTP geography " + suffix]);
    await pool.query("insert into identity_sessions(identity_id, expires_at, token_hash, request_context) values ($1, now() + interval '10 minutes', $2, $3::jsonb)", [identityId, tokenHash, JSON.stringify({ purpose: "disposable-bwg-http-acceptance" })]);
    const fixture = { identityId, organizationId, geographyId, tokenHash, token, extraGeographyIds: [] as string[], periodIds: [] as string[], schemeIds: [] as string[], activityIds: [] as string[], evidenceIds: [] as string[], verificationIds: [] as string[], verifierIdentityIds: [] as string[] };
    fixtures.push(fixture);
    return fixture;
  };

  const seedEvidence = async (fixture: (typeof fixtures)[number], status: "CAPTURED" | "VERIFIED") => {
    await pool.query("insert into organization_geography_scopes(organization_id, geography_id, status) values ($1,$2,'VERIFIED') on conflict (organization_id,geography_id) do update set status='VERIFIED'", [fixture.organizationId, fixture.geographyId]);
    const activityId = randomUUID();
    await pool.query("insert into activities(id,organization_id,actor_identity_id,geography_id,activity_type) values ($1,$2,$3,$4,'BWG_WASTE_GENERATION')", [activityId, fixture.organizationId, fixture.identityId, fixture.geographyId]);
    const evidenceId = randomUUID();
    await pool.query("insert into evidence(id,activity_id,evidence_type,status,captured_at,content_hash,captured_by_identity_id) values ($1,$2,'DISPOSABLE_ACCEPTANCE_EVIDENCE',$3,now(),$4,$5)", [evidenceId, activityId, status, createHash("sha256").update(randomUUID()).digest("hex"), fixture.identityId]);
    fixture.activityIds?.push(activityId);
    fixture.evidenceIds?.push(evidenceId);
    return { activityId, evidenceId };
  };

  const approveEvidence = async (fixture: (typeof fixtures)[number], evidenceId: string) => {
    const verifierIdentityId = randomUUID();
    const verifierRoleId = randomUUID();
    const verificationId = randomUUID();
    const suffix = randomUUID().replaceAll("-", "");
    await pool.query("insert into identities(id,display_name,status) values ($1,$2,'VERIFIED')", [verifierIdentityId, "BWG HTTP verifier " + suffix]);
    await pool.query("insert into roles(id,organization_id,name,permissions,geography_scope) values ($1,$2,$3,$4::jsonb,'[]'::jsonb)", [verifierRoleId, fixture.organizationId, "BWG HTTP verifier " + suffix, JSON.stringify(["VERIFY_EVIDENCE"])]);
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values ($1,$2,$3,'VERIFIED')", [verifierIdentityId, fixture.organizationId, verifierRoleId]);
    await pool.query("insert into verifications(id,evidence_id,verifier_identity_id,decision,scope,rationale) values ($1,$2,$3,'APPROVED','BWG_REPORT_ACCEPTANCE','Independent disposable CI acceptance verifier')", [verificationId, evidenceId, verifierIdentityId]);
    fixture.verifierIdentityIds?.push(verifierIdentityId);
    fixture.verificationIds?.push(verificationId);
    return verificationId;
  };

  const app = Fastify({ logger: false });
  try {
    await registerValueRoutes(app, pool);

    // Verified member with no reports:read or profile-update permission.
    const noPermission = await makeFixture(["guardian:read"]);
    const workspaceDenied = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/bwg",
      headers: { authorization: "Bearer " + noPermission.token, "x-rupaykg-organization-id": noPermission.organizationId },
    });

    // Seed a verified applicability profile and period in disposable PostgreSQL so report routes reach their permission checks.
    const reportDenied = await makeFixture(["guardian:read"]);
    await pool.query("insert into bwg_profiles (organization_id, applicability_status, status) values ($1,'APPLICABLE','VERIFIED')", [reportDenied.organizationId]);
    const periodResult = await pool.query("insert into bwg_reporting_periods (organization_id,period_start,period_end,reporting_basis) values ($1,'2026-01-01','2026-01-31','MONTHLY') returning id", [reportDenied.organizationId]);
    const reportPeriodId = periodResult.rows[0].id as string;
    reportDenied.periodIds.push(reportPeriodId);
    const reportHeaders = { authorization: "Bearer " + reportDenied.token, "x-rupaykg-organization-id": reportDenied.organizationId };

    const wasteDenied = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + reportPeriodId + "/waste",
      headers: reportHeaders,
      payload: { wasteStream: "DRY", unit: "KG", generatedQuantity: 10, segregatedQuantity: 10, channelizedQuantity: 8, processedQuantity: 7 },
    });
    assert.equal(wasteDenied.statusCode, 403, wasteDenied.body);
    assert.equal(wasteDenied.json().code, "BWG_WASTE_FORBIDDEN");

    const eprDenied = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + reportPeriodId + "/epr",
      headers: reportHeaders,
      payload: { schemeId: randomUUID(), categoryCode: "PLASTIC", obligatedQuantity: 10, fulfilledQuantity: 8 },
    });
    assert.equal(eprDenied.statusCode, 403, eprDenied.body);
    assert.equal(eprDenied.json().code, "BWG_EPR_FORBIDDEN");

    const esgDenied = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + reportPeriodId + "/esg",
      headers: reportHeaders,
      payload: { metricCode: "WATER", scope: "SCOPE_1", unit: "KL", value: 10 },
    });
    assert.equal(esgDenied.statusCode, 403, esgDenied.body);
    assert.equal(esgDenied.json().code, "BWG_ESG_FORBIDDEN");

    // Authorized report writers may submit operational records; records remain PENDING without verified evidence.
    const wasteWriter = await makeFixture(["waste:record"]);
    await pool.query("insert into bwg_profiles (organization_id, applicability_status, status) values ($1,'APPLICABLE','VERIFIED')", [wasteWriter.organizationId]);
    const wastePeriod = await pool.query("insert into bwg_reporting_periods (organization_id,period_start,period_end,reporting_basis) values ($1,'2026-02-01','2026-02-28','MONTHLY') returning id", [wasteWriter.organizationId]);
    const wastePeriodId = wastePeriod.rows[0].id as string;
    wasteWriter.periodIds.push(wastePeriodId);
    const wasteCreated = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + wastePeriodId + "/waste",
      headers: { authorization: "Bearer " + wasteWriter.token, "x-rupaykg-organization-id": wasteWriter.organizationId },
      payload: { wasteStream: "DRY", unit: "KG", generatedQuantity: 10, segregatedQuantity: 9, channelizedQuantity: 8, processedQuantity: 7 },
    });
    assert.equal(wasteCreated.statusCode, 201, wasteCreated.body);
    assert.equal(wasteCreated.json().wasteReport.status, "PENDING");

    const validEvidence = await seedEvidence(wasteWriter, "VERIFIED");
    const validVerificationId = await approveEvidence(wasteWriter, validEvidence.evidenceId);
    const mismatchedEvidence = await seedEvidence(wasteWriter, "VERIFIED");
    const unverifiedEvidence = await seedEvidence(wasteWriter, "CAPTURED");

    const unverifiedWaste = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + wastePeriodId + "/waste",
      headers: { authorization: "Bearer " + wasteWriter.token, "x-rupaykg-organization-id": wasteWriter.organizationId },
      payload: { wasteStream: "DRY", unit: "KG", generatedQuantity: 10, segregatedQuantity: 9, channelizedQuantity: 8, processedQuantity: 7, evidenceId: unverifiedEvidence.evidenceId },
    });
    assert.equal(unverifiedWaste.statusCode, 409, unverifiedWaste.body);
    assert.equal(unverifiedWaste.json().code, "EVIDENCE_NOT_VERIFIED");

    const mismatchedWaste = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + wastePeriodId + "/waste",
      headers: { authorization: "Bearer " + wasteWriter.token, "x-rupaykg-organization-id": wasteWriter.organizationId },
      payload: { wasteStream: "DRY", unit: "KG", generatedQuantity: 10, segregatedQuantity: 9, channelizedQuantity: 8, processedQuantity: 7, evidenceId: mismatchedEvidence.evidenceId, verificationId: validVerificationId },
    });
    assert.equal(mismatchedWaste.statusCode, 409, mismatchedWaste.body);
    assert.equal(mismatchedWaste.json().code, "VERIFICATION_INVALID");

    const verifiedWaste = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + wastePeriodId + "/waste",
      headers: { authorization: "Bearer " + wasteWriter.token, "x-rupaykg-organization-id": wasteWriter.organizationId },
      payload: { wasteStream: "DRY", unit: "KG", generatedQuantity: 10, segregatedQuantity: 9, channelizedQuantity: 8, processedQuantity: 7, evidenceId: validEvidence.evidenceId, verificationId: validVerificationId },
    });
    assert.equal(verifiedWaste.statusCode, 201, verifiedWaste.body);
    assert.equal(verifiedWaste.json().wasteReport.status, "VERIFIED");
    assert.equal(verifiedWaste.json().wasteReport.evidence_id, validEvidence.evidenceId);
    assert.equal(verifiedWaste.json().wasteReport.verification_id, validVerificationId);

    const eprWriter = await makeFixture(["epr:manage"]);
    await pool.query("insert into bwg_profiles (organization_id, applicability_status, status) values ($1,'APPLICABLE','VERIFIED')", [eprWriter.organizationId]);
    const eprPeriod = await pool.query("insert into bwg_reporting_periods (organization_id,period_start,period_end,reporting_basis) values ($1,'2026-03-01','2026-03-31','MONTHLY') returning id", [eprWriter.organizationId]);
    const eprPeriodId = eprPeriod.rows[0].id as string;
    eprWriter.periodIds.push(eprPeriodId);
    const schemeId = randomUUID();
    await pool.query("insert into epr_schemes (id,code,name,authority,status) values ($1,$2,$3,'CPCB disposable acceptance fixture','VERIFIED')", [schemeId, "BWG-HTTP-EPR-" + randomUUID().replaceAll("-", ""), "BWG HTTP verified scheme"]);
    eprWriter.schemeIds.push(schemeId);
    const eprCreated = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + eprPeriodId + "/epr",
      headers: { authorization: "Bearer " + eprWriter.token, "x-rupaykg-organization-id": eprWriter.organizationId },
      payload: { schemeId, categoryCode: "PLASTIC", obligatedQuantity: 10, fulfilledQuantity: 8 },
    });
    assert.equal(eprCreated.statusCode, 201, eprCreated.body);
    assert.equal(eprCreated.json().externalSubmission, "NOT_SUBMITTED");
    assert.equal(eprCreated.json().eprReport.status, "PENDING");

    const unverifiedEprEvidence = await seedEvidence(eprWriter, "CAPTURED");
    const unverifiedEpr = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + eprPeriodId + "/epr",
      headers: { authorization: "Bearer " + eprWriter.token, "x-rupaykg-organization-id": eprWriter.organizationId },
      payload: { schemeId, categoryCode: "PLASTIC", obligatedQuantity: 10, fulfilledQuantity: 8, evidenceId: unverifiedEprEvidence.evidenceId },
    });
    assert.equal(unverifiedEpr.statusCode, 409, unverifiedEpr.body);
    assert.equal(unverifiedEpr.json().code, "EVIDENCE_NOT_VERIFIED");

    const esgWriter = await makeFixture(["esg:write"]);
    await pool.query("insert into bwg_profiles (organization_id, applicability_status, status) values ($1,'APPLICABLE','VERIFIED')", [esgWriter.organizationId]);
    const esgPeriod = await pool.query("insert into bwg_reporting_periods (organization_id,period_start,period_end,reporting_basis) values ($1,'2026-04-01','2026-04-30','MONTHLY') returning id", [esgWriter.organizationId]);
    const esgPeriodId = esgPeriod.rows[0].id as string;
    esgWriter.periodIds.push(esgPeriodId);
    const esgCreated = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + esgPeriodId + "/esg",
      headers: { authorization: "Bearer " + esgWriter.token, "x-rupaykg-organization-id": esgWriter.organizationId },
      payload: { metricCode: "WATER", scope: "SCOPE_1", unit: "KL", value: 10 },
    });
    assert.equal(esgCreated.statusCode, 201, esgCreated.body);
    assert.equal(esgCreated.json().esgReport.status, "PENDING");

    const unverifiedEsgEvidence = await seedEvidence(esgWriter, "CAPTURED");
    const unverifiedEsg = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/" + esgPeriodId + "/esg",
      headers: { authorization: "Bearer " + esgWriter.token, "x-rupaykg-organization-id": esgWriter.organizationId },
      payload: { metricCode: "WATER", scope: "SCOPE_1", unit: "KL", value: 10, evidenceId: unverifiedEsgEvidence.evidenceId },
    });
    assert.equal(unverifiedEsg.statusCode, 409, unverifiedEsg.body);
    assert.equal(unverifiedEsg.json().code, "EVIDENCE_NOT_VERIFIED");


    assert.equal(workspaceDenied.statusCode, 403, workspaceDenied.body);
    assert.equal(workspaceDenied.json().code, "BWG_WORKSPACE_READ_FORBIDDEN");

    const profileDenied = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer " + noPermission.token, "x-rupaykg-organization-id": noPermission.organizationId },
      payload: { organizationId: noPermission.organizationId, jurisdictionId: noPermission.geographyId, floorAreaSqm: 10, waterConsumptionLpd: 20, wasteGenerationKgDay: 30, establishmentType: "HOTEL" },
    });
    assert.equal(profileDenied.statusCode, 403, profileDenied.body);
    assert.equal(profileDenied.json().code, "BWG_PROFILE_FORBIDDEN");

    // A PENDING membership is not returned by authentication's VERIFIED membership query.
    const unverified = await makeFixture(["profile:update"], "PENDING");
    const unverifiedDenied = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer " + unverified.token },
      payload: { organizationId: unverified.organizationId, jurisdictionId: unverified.geographyId, floorAreaSqm: 10, waterConsumptionLpd: 20, wasteGenerationKgDay: 30, establishmentType: "HOTEL" },
    });
    assert.equal(unverifiedDenied.statusCode, 403, unverifiedDenied.body);
    assert.equal(unverifiedDenied.json().code, "ORG_FORBIDDEN");

    // The caller cannot select a different organization through the request body.
    const scoped = await makeFixture(["profile:update"]);
    const crossOrganizationDenied = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer " + scoped.token, "x-rupaykg-organization-id": scoped.organizationId },
      payload: { organizationId: randomUUID(), jurisdictionId: scoped.geographyId, floorAreaSqm: 10, waterConsumptionLpd: 20, wasteGenerationKgDay: 30, establishmentType: "HOTEL" },
    });
    assert.equal(crossOrganizationDenied.statusCode, 403, crossOrganizationDenied.body);
    assert.equal(crossOrganizationDenied.json().code, "ORG_FORBIDDEN");

    // A permitted member with a matching verified geography can submit intake, but it remains review-required.
    const profileWriteFixture = await makeFixture(["profile:update"]);
    await pool.query("insert into organization_geography_scopes(organization_id, geography_id, status) values ($1,$2,'VERIFIED')", [profileWriteFixture.organizationId, profileWriteFixture.geographyId]);
    const profileCreated = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer " + profileWriteFixture.token, "x-rupaykg-organization-id": profileWriteFixture.organizationId },
      payload: { organizationId: profileWriteFixture.organizationId, jurisdictionId: profileWriteFixture.geographyId, floorAreaSqm: 10, waterConsumptionLpd: 20, wasteGenerationKgDay: 30, establishmentType: "HOTEL" },
    });
    assert.equal(profileCreated.statusCode, 201, profileCreated.body);
    assert.equal(profileCreated.json().profile.applicability_status, "REVIEW_REQUIRED");
    assert.equal(profileCreated.json().profile.regulatory_registration_status, "UNKNOWN");

    // Even an authorized profile writer is denied a jurisdiction outside the organization's verified geography scope.
    const geographyDeniedFixture = await makeFixture(["profile:update"]);
    const allowedGeographyId = randomUUID();
    const allowedGeographyCode = "BWG-HTTP-ALLOWED-" + randomUUID().replaceAll("-", "");
    await pool.query("insert into geography(id, kind, code, name, source, source_version) values ($1,'CLUSTER',$2,$3,'RupayKG disposable BWG HTTP fixture','v1')", [allowedGeographyId, allowedGeographyCode, "BWG HTTP allowed geography"]);
    await pool.query("insert into organization_geography_scopes(organization_id, geography_id, status) values ($1,$2,'VERIFIED')", [geographyDeniedFixture.organizationId, allowedGeographyId]);
    geographyDeniedFixture.extraGeographyIds = [allowedGeographyId];
    const geographyDenied = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer " + geographyDeniedFixture.token, "x-rupaykg-organization-id": geographyDeniedFixture.organizationId },
      payload: { organizationId: geographyDeniedFixture.organizationId, jurisdictionId: geographyDeniedFixture.geographyId, floorAreaSqm: 10, waterConsumptionLpd: 20, wasteGenerationKgDay: 30, establishmentType: "HOTEL" },
    });
    assert.equal(geographyDenied.statusCode, 403, geographyDenied.body);
    assert.equal(geographyDenied.json().code, "GEOGRAPHY_FORBIDDEN");

    // The route-level checks above must leave no BWG profile rows behind.
    const deniedOrganizationIds = [noPermission.organizationId, unverified.organizationId, scoped.organizationId, geographyDeniedFixture.organizationId];
    const profileRows = await pool.query("select count(*)::int as count from bwg_profiles where organization_id = any($1::uuid[])", [deniedOrganizationIds]);
    assert.equal(profileRows.rows[0]?.count, 0);
    for (const [table, periodColumn] of [["bwg_waste_reports", "reporting_period_id"], ["bwg_epr_reports", "reporting_period_id"], ["bwg_esg_reports", "reporting_period_id"]] as const) {
      const rows = await pool.query(`select count(*)::int as count from ${table} where ${periodColumn} = any($1::uuid[])`, [reportDenied.periodIds]);
      assert.equal(rows.rows[0]?.count, 0, table + " must remain unchanged after permission denial");
    }
  } finally {
    await app.close();
    for (const fixture of fixtures.reverse()) {
      await pool.query("delete from identity_sessions where token_hash=$1", [fixture.tokenHash]);
      await pool.query("delete from organization_memberships where identity_id=$1 and organization_id=$2", [fixture.identityId, fixture.organizationId]);
      await pool.query("delete from roles where organization_id=$1", [fixture.organizationId]);
      await pool.query("delete from organization_geography_scopes where organization_id=$1", [fixture.organizationId]);
      for (const periodId of fixture.periodIds ?? []) {
        await pool.query("delete from bwg_waste_reports where reporting_period_id=$1", [periodId]);
        await pool.query("delete from bwg_epr_reports where reporting_period_id=$1", [periodId]);
        await pool.query("delete from bwg_esg_reports where reporting_period_id=$1", [periodId]);
        await pool.query("delete from bwg_reporting_periods where id=$1", [periodId]);
      }
      for (const verificationId of fixture.verificationIds ?? []) await pool.query("delete from verifications where id=$1", [verificationId]);
      for (const evidenceId of fixture.evidenceIds ?? []) await pool.query("delete from evidence where id=$1", [evidenceId]);
      for (const activityId of fixture.activityIds ?? []) await pool.query("delete from activities where id=$1", [activityId]);
      for (const schemeId of fixture.schemeIds ?? []) await pool.query("delete from epr_schemes where id=$1", [schemeId]);
      for (const verifierIdentityId of fixture.verifierIdentityIds ?? []) {
        await pool.query("delete from organization_memberships where identity_id=$1", [verifierIdentityId]);
        await pool.query("delete from identities where id=$1", [verifierIdentityId]);
      }
      await pool.query("delete from bwg_profiles where organization_id=$1", [fixture.organizationId]);
      for (const geographyId of [fixture.geographyId, ...(fixture.extraGeographyIds ?? [])]) await pool.query("delete from geography where id=$1", [geographyId]);
      await pool.query("delete from organizations where id=$1", [fixture.organizationId]);
      await pool.query("delete from identities where id=$1", [fixture.identityId]);
    }
    await pool.end();
  }
});
