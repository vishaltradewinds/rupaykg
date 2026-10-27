import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { explainAgenticPlan, readAgenticModelConfig } from "./agentic-model.js";

export type AgenticGoal =
  | "review_measurements"
  | "prepare_compliance"
  | "trace_resource_flow"
  | "onboard_stakeholder";

export type AgenticStep = {
  id: string;
  title: string;
  status: "READY" | "BLOCKED" | "REQUIRES_HUMAN";
  reason: string;
  requiredEvidence: string[];
};

export type AgenticPlan = {
  planVersion: "1.0";
  goal: AgenticGoal;
  mode: "READ_ONLY_ADVISORY";
  source: "postgresql";
  syntheticData: false;
  organizationId: string;
  geographyId: string | null;
  sourceRecordIds: string[];
  steps: AgenticStep[];
  blockers: string[];
  canExecute: false;
  humanApprovalRequired: true;
};

const GOALS = new Set<AgenticGoal>([
  "review_measurements",
  "prepare_compliance",
  "trace_resource_flow",
  "onboard_stakeholder",
]);

export function isAgenticGoal(value: unknown): value is AgenticGoal {
  return typeof value === "string" && GOALS.has(value as AgenticGoal);
}

export function buildAgenticPlan(input: {
  goal: AgenticGoal;
  organizationId: string;
  geographyId: string | null;
  sourceRecordIds: string[];
  measurementCount: number;
  evidenceCount: number;
  verifiedCount: number;
}): AgenticPlan {
  const { goal, organizationId, geographyId, sourceRecordIds } = input;
  const hasSources = sourceRecordIds.length > 0;
  const hasMeasurements = input.measurementCount > 0;
  const hasEvidence = input.evidenceCount > 0;
  const hasVerified = input.verifiedCount > 0;
  const steps: AgenticStep[] = [];

  if (goal === "review_measurements") {
    steps.push(
      { id: "scope", title: "Confirm organization and geography scope", status: "READY", reason: "The request is authenticated and scoped to a verified organization membership.", requiredEvidence: ["verified_membership", "geography_scope"] },
      { id: "source", title: "Locate authoritative activity records", status: hasSources ? "READY" : "BLOCKED", reason: hasSources ? `Found ${sourceRecordIds.length} in-scope activity record(s).` : "No in-scope activity records were found; the agent will not invent source data.", requiredEvidence: ["activity_record_ids"] },
      { id: "measurements", title: "Review recorded measurements", status: hasMeasurements ? "READY" : "BLOCKED", reason: hasMeasurements ? `Found ${input.measurementCount} measurement record(s).` : "No authoritative measurements are available for this scope.", requiredEvidence: ["measurement value", "unit", "method", "source", "measured_at"] },
      { id: "human-review", title: "Human review of anomalies and proposed follow-up", status: "REQUIRES_HUMAN", reason: "AI-generated interpretations remain advisory; a qualified person must review before any downstream decision.", requiredEvidence: ["reviewer identity", "decision rationale"] },
    );
  } else if (goal === "prepare_compliance") {
    steps.push(
      { id: "scope", title: "Confirm organization and geography scope", status: "READY", reason: "The request is authenticated and scoped to a verified organization membership.", requiredEvidence: ["verified_membership", "geography_scope"] },
      { id: "source", title: "Collect in-scope operational records", status: hasSources ? "READY" : "BLOCKED", reason: hasSources ? `Found ${sourceRecordIds.length} in-scope activity record(s).` : "Compliance preparation cannot proceed without authoritative activity records.", requiredEvidence: ["activity records", "applicable period"] },
      { id: "evidence", title: "Check supporting evidence coverage", status: hasEvidence ? "READY" : "BLOCKED", reason: hasEvidence ? `Found ${input.evidenceCount} evidence record(s).` : "No supporting evidence records are available; do not assert compliance.", requiredEvidence: ["traceable evidence", "source and capture time"] },
      { id: "verification", title: "Check independent verification status", status: hasVerified ? "READY" : "BLOCKED", reason: hasVerified ? `Found ${input.verifiedCount} approved verification record(s).` : "No approved verification records are available; compliance status remains unverified.", requiredEvidence: ["authorized verifier", "verification decision"] },
      { id: "human-review", title: "Human compliance review and statutory applicability check", status: "REQUIRES_HUMAN", reason: "The agent cannot determine legal applicability conclusively, submit statutory returns, or certify compliance.", requiredEvidence: ["applicable rule and period", "reviewer decision", "approval evidence"] },
    );
  } else if (goal === "trace_resource_flow") {
    steps.push(
      { id: "scope", title: "Confirm organization and geography scope", status: "READY", reason: "The request is authenticated and scoped to a verified organization membership.", requiredEvidence: ["verified_membership", "geography_scope"] },
      { id: "source", title: "Locate operational activity records", status: hasSources ? "READY" : "BLOCKED", reason: hasSources ? `Found ${sourceRecordIds.length} in-scope activity record(s).` : "No authoritative activities are available to anchor a resource-flow trace.", requiredEvidence: ["activity identifiers", "origin and destination"] },
      { id: "evidence", title: "Reconcile custody and supporting evidence", status: hasEvidence ? "READY" : "BLOCKED", reason: hasEvidence ? `Found ${input.evidenceCount} evidence record(s); completeness still requires review.` : "No evidence records are available to substantiate custody.", requiredEvidence: ["handover evidence", "weighment or quantity evidence", "timestamps"] },
      { id: "human-review", title: "Resolve gaps before asserting a reconciled flow", status: "REQUIRES_HUMAN", reason: "The agent will not infer missing custody events or write authoritative resource-flow records.", requiredEvidence: ["exception resolution", "authorized reviewer"] },
    );
  } else {
    steps.push(
      { id: "scope", title: "Confirm organization and geography scope", status: "READY", reason: "The request is authenticated and scoped to a verified organization membership.", requiredEvidence: ["verified_membership", "geography_scope"] },
      { id: "source", title: "Inspect existing onboarding and organization records", status: hasSources ? "READY" : "BLOCKED", reason: hasSources ? `Found ${sourceRecordIds.length} stakeholder application record(s) in the authorized organization scope.` : "No stakeholder applications were found in this organization/geography scope; this endpoint does not create stakeholder or membership records.", requiredEvidence: ["legal identity", "organization details", "authorized representative"] },
      { id: "due-diligence", title: "Complete stakeholder due diligence", status: hasEvidence && hasVerified ? "READY" : "BLOCKED", reason: hasEvidence && hasVerified ? "Legal evidence and organization verification records exist; a reviewer must still confirm identity, role mandate and applicable registration requirements." : "Legal evidence and verified organization status are incomplete; identity, statutory registrations, role authority and geography scope must be checked.", requiredEvidence: ["identity verification", "registration evidence where applicable", "role and mandate evidence"] },
      { id: "human-review", title: "Authorized onboarding decision", status: "REQUIRES_HUMAN", reason: "The agent may prepare a checklist but cannot approve identity, membership, or statutory eligibility.", requiredEvidence: ["authorized reviewer", "decision record"] },
    );
  }

  const blockers = steps.filter(step => step.status === "BLOCKED").map(step => `${step.id}: ${step.reason}`);
  return {
    planVersion: "1.0",
    goal,
    mode: "READ_ONLY_ADVISORY",
    source: "postgresql",
    syntheticData: false,
    organizationId,
    geographyId,
    sourceRecordIds,
    steps,
    blockers,
    canExecute: false,
    humanApprovalRequired: true,
  };
}

export async function registerAgenticWorkflowRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/agentic/capabilities", async () => ({
    service: "rupaykg-agentic-workflow",
    version: "1.0",
    mode: "READ_ONLY_ADVISORY",
    capabilities: [
      { goal: "review_measurements", description: "Plan measurement review using scoped operational records." },
      { goal: "prepare_compliance", description: "Identify missing activity, evidence and verification prerequisites before human compliance review." },
      { goal: "trace_resource_flow", description: "Plan a source-grounded custody and evidence reconciliation." },
      { goal: "onboard_stakeholder", description: "Prepare stakeholder due-diligence steps without approving identity or membership." },
    ],
    guardrails: ["authenticated organization scope", "source-grounded outputs", "no synthetic evidence", "no authoritative mutations", "human approval for consequential decisions"],
    productionCertification: "HOLD",
  }));

  app.post("/api/v1/agentic/plan", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
    if (!isAgenticGoal(body.goal)) return reply.code(400).send({ error: "goal must be one of review_measurements, prepare_compliance, trace_resource_flow, onboard_stakeholder", code: "AGENTIC_GOAL_INVALID" });
    const organizationId = auth.activeOrganizationId;
    if (!organizationId) return reply.code(403).send({ error: "Select an active verified organization before requesting an agentic plan", code: "ORGANIZATION_SCOPE_REQUIRED" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["audit:read", "projects:manage"])) {
      return reply.code(403).send({ error: "Agentic planning requires audit:read or projects:manage permission", code: "AGENTIC_PLAN_FORBIDDEN" });
    }
    const geographyId = typeof body.geographyId === "string" && body.geographyId.trim() ? body.geographyId.trim() : null;
    if (geographyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(geographyId)) return reply.code(400).send({ error: "Invalid geography UUID", code: "GEOGRAPHY_ID_INVALID" });
    if (geographyId) {
      const scope = await pool.query<{ ok: boolean }>(
        `select exists (select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3::uuid)) as ok`,
        [auth.identityId, organizationId, geographyId],
      );
      if (!scope.rows[0]?.ok) return reply.code(403).send({ error: "Geography outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
    }
    try {
      const rows = body.goal === "onboard_stakeholder"
        ? await pool.query<{ id: string; measurement_count: string; evidence_count: string; verified_count: string }>(
            `select sa.id, '0'::text as measurement_count,
              (select count(*)::text from organization_verification_evidence ove where ove.organization_id=sa.organization_id) as evidence_count,
              (case when o.verification_status='VERIFIED' then '1' else '0' end)::text as verified_count
             from stakeholder_applications sa join organizations o on o.id=sa.organization_id
             where sa.organization_id=$1
               and ($2::uuid is null or sa.geography_id=$2::uuid)
               and (sa.geography_id is null or organization_has_geography_scope(sa.organization_id,sa.geography_id))
             order by sa.created_at desc limit 100`,
            [organizationId, geographyId],
          )
        : await pool.query<{ id: string; measurement_count: string; evidence_count: string; verified_count: string }>(
            `select a.id,
              (select count(*)::text from measurements m where m.activity_id=a.id) as measurement_count,
              (select count(*)::text from evidence e where e.activity_id=a.id) as evidence_count,
              (select count(*)::text from verifications v where v.activity_id=a.id and v.decision='APPROVED') as verified_count
             from activities a
             where a.organization_id=$1
               and a.geography_id is not null
               and organization_has_geography_scope(a.organization_id,a.geography_id)
               and ($2::uuid is null or a.geography_id=$2::uuid)
             order by a.created_at desc limit 100`,
            [organizationId, geographyId],
          );
      const measurements = rows.rows.reduce((sum, row) => sum + Number(row.measurement_count), 0);
      const evidence = rows.rows.reduce((sum, row) => sum + Number(row.evidence_count), 0);
      const verified = rows.rows.reduce((sum, row) => sum + Number(row.verified_count), 0);
      const plan = buildAgenticPlan({
        goal: body.goal,
        organizationId,
        geographyId,
        sourceRecordIds: rows.rows.map(row => row.id),
        measurementCount: measurements,
        evidenceCount: evidence,
        verifiedCount: verified,
      });
      request.log.info({ event: "agentic.plan.created", goal: plan.goal, organizationId, geographyId, sourceRecordCount: plan.sourceRecordIds.length, blockerCount: plan.blockers.length });
      const query = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {};
      if (query.explain === "true") {
        const modelConfig = readAgenticModelConfig();
        const modelExplanation = await explainAgenticPlan(plan, modelConfig);
        request.log.info({ event: "agentic.plan.explanation", goal: plan.goal, status: modelExplanation.status });
        return reply.send({ ...plan, modelExplanation });
      }
      return reply.send(plan);
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Agentic planning could not read authoritative records", code: "AGENTIC_DATA_UNAVAILABLE", syntheticData: false });
    }
  });
}
