import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { withTenantTransaction } from "./tenant-db.js";
import { buildReportSnapshot, computeReportSnapshotHash, reportSnapshotToCsv, type ReportEvidence, type ReportQuality, type ReportRow, type ReportSnapshot } from "./reporting-engine.js";
import { createReportPdf, createReportXlsx } from "./reporting-export.js";

type Context = "urban" | "rural";
type Query = { periodStart?: string; periodEnd?: string; context?: string; geographyId?: string };
type ActivityRow = { id: string; activity_type: string; status: string; occurred_at: Date | string; geography_id: string | null; geography_name: string | null; geography_kind: string | null; actor_role_name: string | null; actor_role_count: number };
type MeasurementRow = { id: string; activity_id: string; value: string | number; unit: string; method: string; source: string; measured_at: Date | string; quality_status: string | null };
type EvidenceRow = { id: string; activity_id: string; measurement_id: string | null; content_hash: string | null; status: string; verification_id: string | null; verification_decision: string | null };
type FlowRow = { id: string; origin_type: string; resource_form: string; material_code: string; declared_quantity: string | number; unit: string; status: string; source_geography_name: string | null; destination_geography_name: string | null };
type CustodyRow = { id: string; resource_flow_id: string; sequence_no: number; actor_organization_id: string | null; activity_id: string | null; quantity: string | number; unit: string; recorded_at: Date | string; evidence_id: string | null; content_hash: string | null; evidence_status: string | null; verification_id: string | null; verification_decision: string | null; from_geography_name: string | null; to_geography_name: string | null };
type ReportData = { snapshot: ReportSnapshot; truncated: boolean };

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}
export function normalizeReportQuality(value: string | null): ReportQuality {
  const status = value?.trim().toUpperCase();
  if (status === "ESTIMATED") return "ESTIMATED";
  if (status === "DISPUTED") return "DISPUTED";
  if (status === "MISSING" || !status) return "MISSING";
  if (["OBSERVED", "MEASURED", "ACCEPTED", "VERIFIED"].includes(status)) return "OBSERVED";
  return "MISSING";
}
export function stakeholderFromVerifiedRole(roleName: string | null, roleCount: number): {
  stakeholder: ReportRow["stakeholder"];
  attribution: "VERIFIED" | "UNMAPPED";
} {
  const role = roleName?.trim().toLowerCase();
  if (!role || roleCount !== 1) return { stakeholder: "OTHER", attribution: "UNMAPPED" };
  const roleMap: Record<string, ReportRow["stakeholder"]> = {
    aggregator: "AGGREGATOR",
    processor: "PROCESSOR",
    recycler: "RECYCLER",
    transporter: "TRANSPORTER",
    collector_transporter: "TRANSPORTER",
    generator: "GENERATOR",
    municipal_generator: "GENERATOR",
    industry_generator: "GENERATOR",
    commercial_generator: "GENERATOR",
    institution_generator: "GENERATOR",
    bwg: "BWG",
    bulk_waste_generator: "BWG",
    municipal_admin: "ULB",
    ulb_admin: "ULB",
    gram_panchayat_admin: "GRAM_PANCHAYAT",
    panchayat_admin: "GRAM_PANCHAYAT",
  };
  const stakeholder = roleMap[role];
  return stakeholder ? { stakeholder, attribution: "VERIFIED" } : { stakeholder: "OTHER", attribution: "UNMAPPED" };
}
export function parseSwmReportQuery(query: Query): { periodStart: string; periodEnd: string; context: Context; geographyId?: string } | null {
  if (!isDate(query.periodStart) || !isDate(query.periodEnd) || query.periodStart > query.periodEnd) return null;
  if (query.context !== "urban" && query.context !== "rural") return null;
  if (query.geographyId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.geographyId)) return null;
  return { periodStart: query.periodStart, periodEnd: query.periodEnd, context: query.context, ...(query.geographyId ? { geographyId: query.geographyId } : {}) };
}
async function loadSwmReport(pool: Pool, auth: AuthContext, params: NonNullable<ReturnType<typeof parseSwmReportQuery>>, generatedAt?: string, access: "read" | "export" = "read"): Promise<ReportData> {
  if (!auth.activeOrganizationId || !auth.memberships.some(m => m.status === "VERIFIED" && m.organization_id === auth.activeOrganizationId)) {
    throw Object.assign(new Error("Verified active organization membership is required"), { code: "REPORT_FORBIDDEN" });
  }
  return withTenantTransaction(pool, auth, async client => {
    if (access === "export") await requireReportExport(client, auth);
    else await requireReportRead(client, auth);
    const geographyKinds = params.context === "urban" ? ["ULB", "WARD"] : ["GRAM_PANCHAYAT", "VILLAGE", "CLUSTER"];
    if (params.geographyId) {
      const scope = await client.query<{ ok: boolean }>(
        "select organization_has_geography_scope($1::uuid,$2::uuid) as ok",
        [auth.activeOrganizationId, params.geographyId],
      );
      if (!scope.rows[0]?.ok) throw Object.assign(new Error("Geography outside organization authorization scope"), { code: "GEOGRAPHY_FORBIDDEN" });
    }
    const values: unknown[] = [auth.activeOrganizationId, params.periodStart, params.periodEnd, geographyKinds];
    const geographyClause = params.geographyId ? " and a.geography_id=$5::uuid" : "";
    if (params.geographyId) values.push(params.geographyId);
    const activityResult = await client.query<ActivityRow>(
      `select a.id,a.activity_type,a.status,a.occurred_at,a.geography_id,g.name as geography_name,g.kind::text as geography_kind,
              actor_role.role_name as actor_role_name,coalesce(actor_role.role_count,0)::int as actor_role_count
       from activities a
       left join geography g on g.id=a.geography_id
       left join lateral (
         select min(lower(r.name)) filter (where lower(r.name) in (
                  'aggregator','processor','recycler','transporter','collector_transporter','generator',
                  'municipal_generator','industry_generator','commercial_generator','institution_generator',
                  'bwg','bulk_waste_generator','municipal_admin','ulb_admin','gram_panchayat_admin','panchayat_admin'
                )) as role_name,
                count(distinct lower(r.name)) filter (where lower(r.name) in (
                  'aggregator','processor','recycler','transporter','collector_transporter','generator',
                  'municipal_generator','industry_generator','commercial_generator','institution_generator',
                  'bwg','bulk_waste_generator','municipal_admin','ulb_admin','gram_panchayat_admin','panchayat_admin'
                ))::int as role_count
           from organization_memberships om
           join roles r on r.id=om.role_id and r.organization_id=om.organization_id
          where om.identity_id=a.actor_identity_id
            and om.organization_id=a.organization_id
            and om.status='VERIFIED'
       ) actor_role on true
       where a.organization_id=$1::uuid and a.occurred_at >= $2::date and a.occurred_at < ($3::date + interval '1 day')
       and organization_has_geography_scope(a.organization_id,a.geography_id)
       and exists(select 1 from geography context_geo where context_geo.id=a.geography_id and context_geo.kind::text=any($4::text[]))
       ${geographyClause}
       order by a.occurred_at,a.id limit 501`,
      values,
    );
    const truncated = activityResult.rows.length > 500;
    const activities = activityResult.rows.slice(0, 500);
    const activityIds = activities.map(row => row.id);
    const [measurementResult, evidenceResult, flowResult, custodyResult] = await Promise.all([
      client.query<MeasurementRow>(
        `select m.id,m.activity_id,m.value,m.unit,m.method,m.source,m.measured_at,m.quality_status
         from measurements m join activities a on a.id=m.activity_id
         where a.organization_id=$1::uuid and m.activity_id=any($2::uuid[])
         and organization_has_geography_scope(a.organization_id,a.geography_id)
         order by m.measured_at,m.id`,
        [auth.activeOrganizationId, activityIds],
      ),
      client.query<EvidenceRow>(
        `select e.id,e.activity_id,e.measurement_id,e.content_hash,e.status,v.id as verification_id,v.decision as verification_decision
         from evidence e join activities a on a.id=e.activity_id
         left join lateral (select id,decision from verifications where evidence_id=e.id order by decided_at desc,id desc limit 1) v on true
         where a.organization_id=$1::uuid and e.activity_id=any($2::uuid[])
         and organization_has_geography_scope(a.organization_id,a.geography_id)
         order by e.captured_at,e.id`,
        [auth.activeOrganizationId, activityIds],
      ),
      client.query<FlowRow>(
        `select rf.id,rf.origin_type,rf.resource_form,rf.material_code,rf.declared_quantity,rf.unit,rf.status,
                sg.name as source_geography_name,dg.name as destination_geography_name
         from resource_flows rf
         left join geography sg on sg.id=rf.source_geography_id
         left join geography dg on dg.id=rf.destination_geography_id
         where rf.organization_id=$1::uuid and rf.created_at >= $2::date and rf.created_at < ($3::date + interval '1 day')
         and ((rf.source_geography_id is not null and organization_has_geography_scope(rf.organization_id,rf.source_geography_id))
           or (rf.destination_geography_id is not null and organization_has_geography_scope(rf.organization_id,rf.destination_geography_id)))
         and (exists(select 1 from geography source_geo where source_geo.id=rf.source_geography_id and source_geo.kind::text=any($4::text[]))
           or exists(select 1 from geography destination_geo where destination_geo.id=rf.destination_geography_id and destination_geo.kind::text=any($4::text[])))
         ${params.geographyId ? "and (rf.source_geography_id=$5::uuid or rf.destination_geography_id=$5::uuid)" : ""}
         order by rf.created_at,rf.id limit 501` ,
        values,
      ),
      client.query<CustodyRow>(
        `select ccl.id,ccl.resource_flow_id,ccl.sequence_no,ccl.actor_organization_id,ccl.activity_id,
                ccl.quantity,ccl.unit,ccl.recorded_at,ccl.evidence_id,e.content_hash,e.status as evidence_status,
                v.id as verification_id,v.decision as verification_decision,fg.name as from_geography_name,tg.name as to_geography_name
         from chain_of_custody_links ccl
         join resource_flows rf on rf.id=ccl.resource_flow_id
         left join geography fg on fg.id=ccl.from_geography_id
         left join geography tg on tg.id=ccl.to_geography_id
         left join evidence e on e.id=ccl.evidence_id
         left join lateral (select id,decision from verifications where evidence_id=e.id order by decided_at desc,id desc limit 1) v on true
         where rf.organization_id=$1::uuid and ccl.recorded_at >= $2::date and ccl.recorded_at < ($3::date + interval '1 day')
         and ((ccl.from_geography_id is not null and organization_has_geography_scope(rf.organization_id,ccl.from_geography_id))
           or (ccl.to_geography_id is not null and organization_has_geography_scope(rf.organization_id,ccl.to_geography_id)))
         and (exists(select 1 from geography from_geo where from_geo.id=ccl.from_geography_id and from_geo.kind::text=any($4::text[]))
           or exists(select 1 from geography to_geo where to_geo.id=ccl.to_geography_id and to_geo.kind::text=any($4::text[])))
         ${params.geographyId ? "and (ccl.from_geography_id=$5::uuid or ccl.to_geography_id=$5::uuid)" : ""}
         order by ccl.resource_flow_id,ccl.sequence_no,ccl.recorded_at limit 501` ,
        values,
      ),
    ]);
    const measurementsByActivity = new Map<string, MeasurementRow[]>();
    for (const measurement of measurementResult.rows) {
      const list = measurementsByActivity.get(measurement.activity_id) ?? [];
      list.push(measurement); measurementsByActivity.set(measurement.activity_id, list);
    }
    const evidenceByActivity = new Map<string, EvidenceRow[]>();
    for (const evidence of evidenceResult.rows) {
      const list = evidenceByActivity.get(evidence.activity_id) ?? [];
      list.push(evidence); evidenceByActivity.set(evidence.activity_id, list);
    }
    const rows: ReportRow[] = activities.map(activity => {
      const measurements = measurementsByActivity.get(activity.id) ?? [];
      const evidence = evidenceByActivity.get(activity.id) ?? [];
      const stakeholder = stakeholderFromVerifiedRole(activity.actor_role_name, activity.actor_role_count);
      const cells = measurements.length ? measurements.map(measurement => {
        const related = evidence.filter(item => item.measurement_id === measurement.id || item.measurement_id === null);
        const evidenceRefs: ReportEvidence[] = related.map(item => ({
          sourceRecordId: activity.id,
          evidenceId: item.id,
          evidenceHash: item.content_hash,
          verificationId: item.verification_id,
          verificationStatus: item.verification_decision ?? (item.status === "VERIFIED" ? "VERIFIED" : item.status),
        }));
        const numericValue = Number(measurement.value);
        return {
          key: `measurement:${measurement.id}`,
          value: Number.isFinite(numericValue) ? numericValue : null,
          unit: measurement.unit,
          quality: Number.isFinite(numericValue) ? normalizeReportQuality(measurement.quality_status) : "MISSING" as const,
          sourceRecordId: activity.id,
          evidence: evidenceRefs,
          note: "Method: " + measurement.method + "; source: " + measurement.source + "; activity type: " + activity.activity_type + "; verified actor role: " + (activity.actor_role_name ?? "unmapped"),
        };
      }) : [{
        key: "measurement:missing",
        value: null,
        unit: null,
        quality: "MISSING" as const,
        sourceRecordId: activity.id,
        evidence: evidence.filter(item => item.measurement_id === null).map(item => ({
          sourceRecordId: activity.id, evidenceId: item.id, evidenceHash: item.content_hash,
          verificationId: item.verification_id,
          verificationStatus: item.verification_decision ?? (item.status === "VERIFIED" ? "VERIFIED" : item.status),
        })),
        note: "No measurement recorded; activity type: " + activity.activity_type + "; verified actor role: " + (activity.actor_role_name ?? "unmapped"),
      }];
      return {
        id: activity.id,
        stakeholder: stakeholder.stakeholder,
        stakeholderAttribution: stakeholder.attribution,
        label: [activity.activity_type, activity.geography_name ?? "Unlabelled geography"].join(" - "),
        cells,
      };
    });
    for (const flow of flowResult.rows.slice(0, 500)) {
      const declared = Number(flow.declared_quantity);
      rows.push({
        id: "resource-flow:" + flow.id,
        stakeholder: "OTHER",
        stakeholderAttribution: "UNMAPPED",
        label: "Declared material flow - " + flow.material_code,
        cells: [{
          key: "declared_quantity",
          value: Number.isFinite(declared) ? declared : null,
          unit: flow.unit,
          quality: Number.isFinite(declared) ? "DECLARED" : "MISSING",
          sourceRecordId: flow.id,
          note: "Origin type: " + flow.origin_type + "; resource form: " + flow.resource_form + "; status: " + flow.status + "; source: " + (flow.source_geography_name ?? "not recorded") + "; destination: " + (flow.destination_geography_name ?? "not recorded"),
        }],
      });
    }
    for (const custody of custodyResult.rows.slice(0, 500)) {
      const evidenceRefs: ReportEvidence[] = custody.evidence_id ? [{
        sourceRecordId: custody.id,
        evidenceId: custody.evidence_id,
        evidenceHash: custody.content_hash,
        verificationId: custody.verification_id,
        verificationStatus: custody.verification_decision ?? (custody.evidence_status === "VERIFIED" ? "VERIFIED" : custody.evidence_status ?? "NOT_REPORTED"),
      }] : [];
      const quantity = Number(custody.quantity);
      rows.push({
        id: "custody:" + custody.id,
        stakeholder: "OTHER",
        stakeholderAttribution: "UNMAPPED",
        label: "Chain-of-custody sequence " + custody.sequence_no,
        cells: [{
          key: "custody_quantity",
          value: Number.isFinite(quantity) ? quantity : null,
          unit: custody.unit,
          quality: Number.isFinite(quantity) ? "DECLARED" : "MISSING",
          sourceRecordId: custody.id,
          evidence: evidenceRefs,
          note: "Resource flow: " + custody.resource_flow_id + "; actor organization: " + (custody.actor_organization_id ?? "not recorded") + "; activity: " + (custody.activity_id ?? "not recorded") + "; from: " + (custody.from_geography_name ?? "not recorded") + "; to: " + (custody.to_geography_name ?? "not recorded") + "; recorded: " + new Date(custody.recorded_at).toISOString(),
        }],
      });
    }
    if (!rows.length) {
      throw Object.assign(new Error("No source activities, material flows or custody links found for the selected tenant, period and geography context"), { code: "REPORT_NO_SOURCE_DATA" });
    }
    const snapshotTruncated = truncated || flowResult.rows.length > 500 || custodyResult.rows.length > 500;
    const sourceRevision = process.env.RENDER_GIT_COMMIT ?? process.env.GITHUB_SHA ?? "unavailable";
    const snapshot = buildReportSnapshot({
      reportType: "CPCB_SWMP_2026",
      title: `SWM 2026 ${params.context.toUpperCase()} reporting preview`,
      organizationId: auth.activeOrganizationId!,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      geographyMode: params.context.toUpperCase() as "URBAN" | "RURAL",
      geographyScopeId: params.geographyId ?? null,
      methodologyCode: "SWM-2026-ACTIVITY-EVIDENCE",
      methodologyVersion: "1.0.0",
      sourceRevision,
      generatedAt: generatedAt ?? new Date().toISOString(),
      rows,
      assumptions: [
        "This is an internal reporting preview, not a CPCB filing, statutory submission, certificate or assurance opinion.",
        "The methodology code and version identify this internal reporting template; they are not an official CPCB-approved calculation methodology.",
        ...(sourceRevision === "unavailable" ? ["Source code revision was unavailable at generation time; the report is not review-ready."] : []),
        "Activity stakeholder categories are resolved only from exactly one recognized role attached to the activity actor through a VERIFIED organization membership; ambiguous and unknown roles remain OTHER/UNMAPPED.",
        "Custody-link actor organization references do not identify the acting identity, so custody stakeholder attribution remains OTHER/UNMAPPED.",
        "Only active-organization activities, measurements, linked evidence, declared material flows and recorded custody links are included; declared quantities remain separately identified.",
        ...(snapshotTruncated ? ["Preview capped at 500 activities, 500 declared material flows and 500 custody links; narrow the period or geography for a complete extract."] : []),
      ],
    });
    return { snapshot, truncated: snapshotTruncated };
  });
}

export function parseReportRunId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

type ReportRunRow = {
  id: string;
  report_type: string;
  title: string;
  period_start: string;
  period_end: string;
  geography_mode: string;
  status: string;
  snapshot_hash: string;
  snapshot: ReportSnapshot;
  created_at: Date | string;
};

async function requireReportRead(client: import("pg").PoolClient, auth: AuthContext): Promise<void> {
  if (!auth.activeOrganizationId ||
      !auth.memberships.some(m => m.status === "VERIFIED" && m.organization_id === auth.activeOrganizationId) ||
      !await hasOrganizationPermission(client, auth, auth.activeOrganizationId, ["reports:read", "swm:read"])) {
    throw Object.assign(new Error("SWM report read permission required"), { code: "REPORT_FORBIDDEN" });
  }
}
async function requireReportExport(client: import("pg").PoolClient, auth: AuthContext): Promise<void> {
  if (!auth.activeOrganizationId ||
      !auth.memberships.some(m => m.status === "VERIFIED" && m.organization_id === auth.activeOrganizationId) ||
      !await hasOrganizationPermission(client, auth, auth.activeOrganizationId, ["reports:export"])) {
    throw Object.assign(new Error("Report export permission required"), { code: "REPORT_EXPORT_FORBIDDEN" });
  }
}

async function loadSavedReportRun(pool: Pool, auth: AuthContext, runId: string, access: "read" | "export" = "read"): Promise<ReportRunRow | null> {
  return withTenantTransaction(pool, auth, async client => {
    if (access === "export") await requireReportExport(client, auth);
    else await requireReportRead(client, auth);
    const result = await client.query<ReportRunRow>(
      `select id,report_type,title,period_start::text,period_end::text,geography_mode,status,
              snapshot_hash,snapshot,created_at
         from report_runs
        where id=$1::uuid and organization_id=$2::uuid`,
      [runId, auth.activeOrganizationId],
    );
    const row = result.rows[0] ?? null;
    if (row && (
      !row.snapshot ||
      typeof row.snapshot !== "object" ||
      row.snapshot.snapshotHash !== row.snapshot_hash ||
      computeReportSnapshotHash(row.snapshot) !== row.snapshot_hash
    )) {
      throw Object.assign(new Error("Stored report snapshot content does not match its canonical SHA-256 integrity hash"), { code: "REPORT_SNAPSHOT_INTEGRITY" });
    }
    return row;
  });
}

export async function registerReportingRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/reports/swm-2026/preview", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const params = parseSwmReportQuery(request.query as Query);
    if (!params) return reply.code(400).send({ error: "Valid periodStart, periodEnd and context=urban|rural are required; geographyId must be a UUID", code: "INVALID_REPORT_QUERY", syntheticData: false });
    try {
      const data = await loadSwmReport(pool, auth, params);
      return { source: "postgresql", syntheticData: false, report: data.snapshot, truncated: data.truncated };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_FORBIDDEN") return reply.code(403).send({ error: "SWM report read permission required", code, syntheticData: false });
      if (code === "GEOGRAPHY_FORBIDDEN") return reply.code(403).send({ error: "Geography outside organization authorization scope", code, syntheticData: false });
      if (code === "REPORT_NO_SOURCE_DATA") return reply.code(404).send({ error: "No source activities found for the selected reporting scope", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "SWM report preview unavailable", code: "REPORT_UNAVAILABLE", syntheticData: false });
    }
  });
  app.post("/api/v1/reports/swm-2026/runs", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const body = request.body as Query & { snapshotHash?: string; generatedAt?: string };
    const params = parseSwmReportQuery(body ?? {});
    if (!params || typeof body?.snapshotHash !== "string" || !/^[0-9a-f]{64}$/i.test(body.snapshotHash) || typeof body.generatedAt !== "string" || Number.isNaN(Date.parse(body.generatedAt)) || new Date(body.generatedAt).toISOString() !== body.generatedAt) {
      return reply.code(400).send({ error: "Valid reporting period, context, generatedAt and preview snapshotHash are required", code: "INVALID_REPORT_RUN", syntheticData: false });
    }
    try {
      const data = await loadSwmReport(pool, auth, params, body.generatedAt);
      if (data.snapshot.snapshotHash !== body.snapshotHash) {
        return reply.code(409).send({ error: "Source records changed after preview. Generate a fresh preview before saving.", code: "REPORT_PREVIEW_STALE", syntheticData: false, currentSnapshotHash: data.snapshot.snapshotHash });
      }
      const saved = await withTenantTransaction(pool, auth, async client => {
        await requireReportRead(client, auth!);
        const result = await client.query<{ id: string; created_at: Date | string }>(
          `insert into report_runs
            (organization_id,created_by_identity_id,report_type,title,period_start,period_end,geography_mode,
             methodology_code,methodology_version,source_revision,generated_at,status,snapshot_hash,snapshot)
           values ($1::uuid,$2::uuid,$3,$4,$5::date,$6::date,$7,$8,$9,$10,$11::timestamptz,$12,$13,$14::jsonb)
           returning id,created_at`,
          [auth!.activeOrganizationId, auth!.identityId, data.snapshot.reportType, data.snapshot.title,
            data.snapshot.periodStart, data.snapshot.periodEnd, data.snapshot.geographyMode,
            data.snapshot.methodologyCode, data.snapshot.methodologyVersion, data.snapshot.sourceRevision,
            data.snapshot.generatedAt, data.snapshot.status, data.snapshot.snapshotHash, JSON.stringify(data.snapshot)],
        );
        return result.rows[0];
      });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, run: { ...saved, reportType: data.snapshot.reportType, status: data.snapshot.status, snapshotHash: data.snapshot.snapshotHash } });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_FORBIDDEN") return reply.code(403).send({ error: "SWM report read permission required", code, syntheticData: false });
      if (code === "GEOGRAPHY_FORBIDDEN") return reply.code(403).send({ error: "Geography outside organization authorization scope", code, syntheticData: false });
      if (code === "REPORT_NO_SOURCE_DATA") return reply.code(404).send({ error: "No source activities found for the selected reporting scope", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "Unable to persist immutable report run", code: "REPORT_RUN_UNAVAILABLE", syntheticData: false });
    }
  });

  app.get("/api/v1/reports/runs", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const query = request.query as { limit?: string; reportType?: string };
    const parsedLimit = Number(query?.limit ?? 20);
    const limit = Number.isInteger(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 20;
    try {
      const runs = await withTenantTransaction(pool, auth, async client => {
        await requireReportRead(client, auth!);
        const result = await client.query(
          `select id,report_type as "reportType",title,period_start::text as "periodStart",
                  period_end::text as "periodEnd",geography_mode as "geographyMode",status,
                  snapshot_hash as "snapshotHash",created_at as "createdAt"
             from report_runs
            where organization_id=$1::uuid and ($2::text is null or report_type=$2)
            order by created_at desc,id desc limit $3`,
          [auth!.activeOrganizationId, query?.reportType?.trim() || null, limit],
        );
        return result.rows;
      });
      return { source: "postgresql", syntheticData: false, runs };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_FORBIDDEN") return reply.code(403).send({ error: "SWM report read permission required", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "Report history unavailable", code: "REPORT_HISTORY_UNAVAILABLE", syntheticData: false });
    }
  });

  app.get("/api/v1/reports/runs/:runId.csv", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const runId = parseReportRunId((request.params as { runId?: string }).runId);
    if (!runId) return reply.code(400).send({ error: "A valid report run UUID is required", code: "INVALID_REPORT_RUN_ID", syntheticData: false });
    try {
      const run = await loadSavedReportRun(pool, auth, runId, "export");
      if (!run) return reply.code(404).send({ error: "Report run not found", code: "REPORT_RUN_NOT_FOUND", syntheticData: false });
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("cache-control", "private, no-store");
      reply.header("content-disposition", `attachment; filename="rupaykg-report-${run.id}.csv"`);
      reply.header("x-rupaykg-report-status", run.status);
      reply.header("x-rupaykg-report-hash", run.snapshot_hash);
      return reportSnapshotToCsv(run.snapshot);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_EXPORT_FORBIDDEN") return reply.code(403).send({ error: "reports:export permission required", code, syntheticData: false });
      if (code === "REPORT_FORBIDDEN") return reply.code(403).send({ error: "SWM report read permission required", code, syntheticData: false });
      if (code === "REPORT_SNAPSHOT_INTEGRITY") return reply.code(409).send({ error: "Stored report snapshot integrity check failed", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "Saved report export unavailable", code: "REPORT_EXPORT_UNAVAILABLE", syntheticData: false });
    }
  });

  app.get("/api/v1/reports/runs/:runId.pdf", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const runId = parseReportRunId((request.params as { runId?: string }).runId);
    if (!runId) return reply.code(400).send({ error: "A valid report run UUID is required", code: "INVALID_REPORT_RUN_ID", syntheticData: false });
    try {
      const run = await loadSavedReportRun(pool, auth, runId, "export");
      if (!run) return reply.code(404).send({ error: "Report run not found", code: "REPORT_RUN_NOT_FOUND", syntheticData: false });
      const buffer = await createReportPdf(run.snapshot);
      reply.header("content-type", "application/pdf");
      reply.header("content-disposition", "attachment; filename=\"rupaykg-report-" + run.id + ".pdf\"");
      reply.header("content-length", String(buffer.byteLength));
      reply.header("cache-control", "private, no-store");
      reply.header("x-rupaykg-report-status", run.status);
      reply.header("x-rupaykg-report-hash", run.snapshot_hash);
      return reply.send(buffer);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_EXPORT_FORBIDDEN") return reply.code(403).send({ error: "reports:export permission required", code, syntheticData: false });
      if (code === "REPORT_SNAPSHOT_INTEGRITY") return reply.code(409).send({ error: "Stored report snapshot integrity check failed", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "Saved PDF export unavailable", code: "REPORT_EXPORT_UNAVAILABLE", syntheticData: false });
    }
  });

  app.get("/api/v1/reports/runs/:runId.xlsx", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const runId = parseReportRunId((request.params as { runId?: string }).runId);
    if (!runId) return reply.code(400).send({ error: "A valid report run UUID is required", code: "INVALID_REPORT_RUN_ID", syntheticData: false });
    try {
      const run = await loadSavedReportRun(pool, auth, runId, "export");
      if (!run) return reply.code(404).send({ error: "Report run not found", code: "REPORT_RUN_NOT_FOUND", syntheticData: false });
      const buffer = await createReportXlsx(run.snapshot);
      reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      reply.header("content-disposition", "attachment; filename=\"rupaykg-report-" + run.id + ".xlsx\"");
      reply.header("content-length", String(buffer.byteLength));
      reply.header("cache-control", "private, no-store");
      reply.header("x-rupaykg-report-status", run.status);
      reply.header("x-rupaykg-report-hash", run.snapshot_hash);
      return reply.send(buffer);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_EXPORT_FORBIDDEN") return reply.code(403).send({ error: "reports:export permission required", code, syntheticData: false });
      if (code === "REPORT_SNAPSHOT_INTEGRITY") return reply.code(409).send({ error: "Stored report snapshot integrity check failed", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "Saved Excel export unavailable", code: "REPORT_EXPORT_UNAVAILABLE", syntheticData: false });
    }
  });

  app.get("/api/v1/reports/runs/:runId", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const runId = parseReportRunId((request.params as { runId?: string }).runId);
    if (!runId) return reply.code(400).send({ error: "A valid report run UUID is required", code: "INVALID_REPORT_RUN_ID", syntheticData: false });
    try {
      const run = await loadSavedReportRun(pool, auth, runId);
      if (!run) return reply.code(404).send({ error: "Report run not found", code: "REPORT_RUN_NOT_FOUND", syntheticData: false });
      return { source: "postgresql", syntheticData: false, run };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_FORBIDDEN") return reply.code(403).send({ error: "SWM report read permission required", code, syntheticData: false });
      if (code === "REPORT_SNAPSHOT_INTEGRITY") return reply.code(409).send({ error: "Stored report snapshot integrity check failed", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "Saved report unavailable", code: "REPORT_RUN_UNAVAILABLE", syntheticData: false });
    }
  });

  app.get("/api/v1/reports/swm-2026/preview.csv", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const params = parseSwmReportQuery(request.query as Query);
    if (!params) return reply.code(400).send({ error: "Valid periodStart, periodEnd and context=urban|rural are required; geographyId must be a UUID", code: "INVALID_REPORT_QUERY", syntheticData: false });
    try {
      const data = await loadSwmReport(pool, auth, params, undefined, "export");
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("cache-control", "private, no-store");
      reply.header("content-disposition", `attachment; filename="rupaykg-swm-2026-${params.context}-${params.periodStart}-${params.periodEnd}.csv"`);
      reply.header("x-rupaykg-report-status", data.snapshot.status);
      reply.header("x-rupaykg-report-hash", data.snapshot.snapshotHash);
      return reportSnapshotToCsv(data.snapshot);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_EXPORT_FORBIDDEN") return reply.code(403).send({ error: "reports:export permission required", code, syntheticData: false });
      if (code === "REPORT_FORBIDDEN") return reply.code(403).send({ error: "SWM report read permission required", code, syntheticData: false });
      if (code === "GEOGRAPHY_FORBIDDEN") return reply.code(403).send({ error: "Geography outside organization authorization scope", code, syntheticData: false });
      if (code === "REPORT_NO_SOURCE_DATA") return reply.code(404).send({ error: "No source activities found for the selected reporting scope", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "SWM CSV export unavailable", code: "REPORT_EXPORT_UNAVAILABLE", syntheticData: false });
    }
  });
}
