import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { withTenantTransaction } from "./tenant-db.js";
import { buildReportSnapshot, reportSnapshotToCsv, type ReportEvidence, type ReportQuality, type ReportRow, type ReportSnapshot } from "./reporting-engine.js";

type Context = "urban" | "rural";
type Query = { periodStart?: string; periodEnd?: string; context?: string; geographyId?: string };
type ActivityRow = { id: string; activity_type: string; status: string; occurred_at: Date | string; geography_id: string | null; geography_name: string | null; geography_kind: string | null };
type MeasurementRow = { id: string; activity_id: string; value: string | number; unit: string; method: string; source: string; measured_at: Date | string; quality_status: string | null };
type EvidenceRow = { id: string; activity_id: string; measurement_id: string | null; content_hash: string | null; status: string; verification_id: string | null; verification_decision: string | null };
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
function stakeholderFromActivity(_activityType: string): ReportRow["stakeholder"] {
  // Activity type is not a validated stakeholder identity. Do not infer Generator/Aggregator/etc.
  return "OTHER";
}
export function parseSwmReportQuery(query: Query): { periodStart: string; periodEnd: string; context: Context; geographyId?: string } | null {
  if (!isDate(query.periodStart) || !isDate(query.periodEnd) || query.periodStart > query.periodEnd) return null;
  if (query.context !== "urban" && query.context !== "rural") return null;
  if (query.geographyId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.geographyId)) return null;
  return { periodStart: query.periodStart, periodEnd: query.periodEnd, context: query.context, ...(query.geographyId ? { geographyId: query.geographyId } : {}) };
}
async function loadSwmReport(pool: Pool, auth: AuthContext, params: NonNullable<ReturnType<typeof parseSwmReportQuery>>): Promise<ReportData> {
  return withTenantTransaction(pool, auth, async client => {
    if (!auth.activeOrganizationId || !await hasOrganizationPermission(client, auth, auth.activeOrganizationId, ["reports:read", "swm:read"])) {
      throw Object.assign(new Error("SWM report read permission required"), { code: "REPORT_FORBIDDEN" });
    }
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
      `select a.id,a.activity_type,a.status,a.occurred_at,a.geography_id,g.name as geography_name,g.kind::text as geography_kind
       from activities a left join geography g on g.id=a.geography_id
       where a.organization_id=$1::uuid and a.occurred_at >= $2::date and a.occurred_at < ($3::date + interval '1 day')
       and organization_has_geography_scope(a.organization_id,a.geography_id)
       and exists(select 1 from geography context_geo where context_geo.id=a.geography_id and context_geo.kind::text=any($4::text[]))
       ${geographyClause}
       order by a.occurred_at,a.id limit 501`,
      values,
    );
    const truncated = activityResult.rows.length > 500;\n    const activities = activityResult.rows.slice(0, 500);
    const activityIds = activities.map(row => row.id);
    if (!activityIds.length) {
      throw Object.assign(new Error("No source activities found for the selected tenant, period and geography context"), { code: "REPORT_NO_SOURCE_DATA" });
    }
    const [measurementResult, evidenceResult] = await Promise.all([
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
          note: `Method: ${measurement.method}; source: ${measurement.source}; activity type: ${activity.activity_type}`,
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
        note: `No measurement recorded; activity type: ${activity.activity_type}`,
      }];
      return {
        id: activity.id,
        stakeholder: stakeholderFromActivity(activity.activity_type),
        label: [activity.activity_type, activity.geography_name ?? "Unlabelled geography"].join(" — "),
        cells,
      };
    });
    const sourceRevision = process.env.RENDER_GIT_COMMIT ?? process.env.GITHUB_SHA ?? "unavailable";
    const snapshot = buildReportSnapshot({
      reportType: "CPCB_SWMP_2026",
      title: `SWM 2026 ${params.context.toUpperCase()} reporting preview`,
      organizationId: auth.activeOrganizationId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      geographyMode: params.context.toUpperCase() as "URBAN" | "RURAL",
      methodologyCode: "SWM-2026-ACTIVITY-EVIDENCE",
      methodologyVersion: "1.0.0",
      sourceRevision,
      generatedAt: new Date().toISOString(),
      rows,
      assumptions: [
        "This is an internal reporting preview, not a CPCB filing, statutory submission, certificate or assurance opinion.",
        "Activity types are not treated as verified stakeholder roles; stakeholder attribution remains OTHER until an authoritative role relationship is available.",
        "Only activity measurements and linked evidence available to the active organization are included.",
        ...(activities.length > 500 ? ["Preview capped at 500 activities; narrow the period or geography for a complete extract."] : []),
      ],
    });
    return { snapshot, truncated };
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
  app.get("/api/v1/reports/swm-2026/preview.csv", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Reporting database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const params = parseSwmReportQuery(request.query as Query);
    if (!params) return reply.code(400).send({ error: "Valid periodStart, periodEnd and context=urban|rural are required; geographyId must be a UUID", code: "INVALID_REPORT_QUERY", syntheticData: false });
    try {
      const data = await loadSwmReport(pool, auth, params);
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="rupaykg-swm-2026-${params.context}-${params.periodStart}-${params.periodEnd}.csv"`);
      reply.header("x-rupaykg-report-status", data.snapshot.status);
      reply.header("x-rupaykg-report-hash", data.snapshot.snapshotHash);
      return reportSnapshotToCsv(data.snapshot);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "REPORT_FORBIDDEN") return reply.code(403).send({ error: "SWM report read permission required", code, syntheticData: false });
      if (code === "GEOGRAPHY_FORBIDDEN") return reply.code(403).send({ error: "Geography outside organization authorization scope", code, syntheticData: false });
      if (code === "REPORT_NO_SOURCE_DATA") return reply.code(404).send({ error: "No source activities found for the selected reporting scope", code, syntheticData: false });
      request.log.error(error);
      return reply.code(503).send({ error: "SWM CSV export unavailable", code: "REPORT_EXPORT_UNAVAILABLE", syntheticData: false });
    }
  });
}
