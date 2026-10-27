import type { Pool } from "pg";
import type { AgenticGoal } from "./agentic-workflow.js";
import { getAgenticToolsForGoal, type AgenticToolId } from "./agentic-tools.js";

export type AgenticReadResult = {
  toolIds: AgenticToolId[];
  sourceRecordIds: string[];
  measurementCount: number;
  evidenceCount: number;
  verifiedCount: number;
};

type ActivityRow = { id: string; measurement_count: string; evidence_count: string; verified_count: string };
type OnboardingRow = { id: string; evidence_count: string; verified_count: string };

/**
 * Fixed, parameterized read-only handlers. The caller must authenticate,
 * authorize every tool for the goal, and validate geography scope first.
 * No model-supplied SQL, table names, filters, or identifiers are accepted.
 */
export async function executeAgenticReadTools(
  pool: Pool,
  input: { goal: AgenticGoal; organizationId: string; geographyId: string | null },
): Promise<AgenticReadResult> {
  const { goal, organizationId, geographyId } = input;
  const toolIds = getAgenticToolsForGoal(goal).map(tool => tool.id);

  if (goal === "onboard_stakeholder") {
    const result = await pool.query<OnboardingRow>(
      `with organization_status as (
         select o.id as organization_id,
           (select count(*)::text from organization_verification_evidence ove where ove.organization_id=o.id) as evidence_count,
           (case when o.verification_status='VERIFIED' then '1' else '0' end)::text as verified_count
         from organizations o
         where o.id=$1
       )
       select sa.id, os.evidence_count, os.verified_count
       from stakeholder_applications sa
       join organization_status os on os.organization_id=sa.organization_id
       where sa.organization_id=$1
         and ($2::uuid is null or sa.geography_id=$2::uuid)
         and (sa.geography_id is null or organization_has_geography_scope(sa.organization_id,sa.geography_id))
       order by sa.created_at desc
       limit 100`,
      [organizationId, geographyId],
    );
    return {
      toolIds,
      sourceRecordIds: result.rows.map(row => row.id),
      measurementCount: 0,
      // Legal evidence and organization verification belong to the organization,
      // not each application. Read these organization-level aggregates once.
      evidenceCount: Number(result.rows[0]?.evidence_count ?? 0),
      verifiedCount: Number(result.rows[0]?.verified_count ?? 0),
    };
  }

  // Do not read or expose aggregate domains unless the goal's allow-list includes them.
  // These SQL fragments are selected only from server-owned constants, never request/model input.
  const measurementSelect = goal === "review_measurements"
    ? "(select count(*)::text from measurements m where m.activity_id=a.id)"
    : "'0'::text";
  const evidenceSelect = goal === "prepare_compliance" || goal === "trace_resource_flow"
    ? "(select count(*)::text from evidence e where e.activity_id=a.id)"
    : "'0'::text";
  const verificationSelect = goal === "prepare_compliance"
    ? "(select count(*)::text from verifications v where v.activity_id=a.id and v.decision='APPROVED')"
    : "'0'::text";
  const result = await pool.query<ActivityRow>(
    `select a.id,
      ${measurementSelect} as measurement_count,
      ${evidenceSelect} as evidence_count,
      ${verificationSelect} as verified_count
     from activities a
     where a.organization_id=$1
       and a.geography_id is not null
       and organization_has_geography_scope(a.organization_id,a.geography_id)
       and ($2::uuid is null or a.geography_id=$2::uuid)
     order by a.created_at desc
     limit 100`,
    [organizationId, geographyId],
  );

  return {
    toolIds,
    sourceRecordIds: result.rows.map(row => row.id),
    measurementCount: result.rows.reduce((sum, row) => sum + Number(row.measurement_count), 0),
    evidenceCount: result.rows.reduce((sum, row) => sum + Number(row.evidence_count), 0),
    verifiedCount: result.rows.reduce((sum, row) => sum + Number(row.verified_count), 0),
  };
}
