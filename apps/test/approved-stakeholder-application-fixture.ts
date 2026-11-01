import type { PoolClient } from "pg";

export interface ApprovedStakeholderApplicationFixtureInput {
  identityId: string;
  organizationId: string;
  roleId: string;
  requestedRoleKey: string;
  requestedOrganizationType: string;
  geographyId: string;
  reviewerIdentityId: string;
  note: string;
}

/**
 * Seeds a fully approved, distinct-reviewer stakeholder application for disposable
 * PostgreSQL integration tests that need an already-authorized membership.
 * It exercises the database approval-chain triggers and is never production code.
 */
export async function createApprovedStakeholderApplicationFixture(
  client: PoolClient,
  input: ApprovedStakeholderApplicationFixtureInput,
): Promise<string> {
  if (input.identityId === input.reviewerIdentityId) {
    throw new Error("A stakeholder application fixture cannot approve itself");
  }
  if (!input.note.trim()) {
    throw new Error("A stakeholder application fixture requires an approval rationale");
  }

  const inserted = await client.query<{ id: string }>(
    "insert into stakeholder_applications (identity_id, organization_id, role_id, requested_role_key, requested_organization_type, geography_id, status, applicant_note) values ($1, $2, $3, $4, $5, $6, 'PENDING', $7) returning id",
    [
      input.identityId,
      input.organizationId,
      input.roleId,
      input.requestedRoleKey,
      input.requestedOrganizationType,
      input.geographyId,
      "Disposable PostgreSQL integration fixture",
    ],
  );
  const applicationId = inserted.rows[0]?.id;
  if (!applicationId) {
    throw new Error("Stakeholder application fixture could not be created");
  }

  const requiredSteps = await client.query<{ id: string }>(
    "select id from stakeholder_application_approvals where application_id=$1 order by step_order",
    [applicationId],
  );
  if (requiredSteps.rows.length === 0) {
    throw new Error("Stakeholder application fixture did not seed a hierarchical approval chain");
  }

  const approvedSteps = await client.query<{ id: string }>(
    "update stakeholder_application_approvals set status='APPROVED', approved_by_identity_id=$2, reviewed_at=clock_timestamp(), review_note=$3 where application_id=$1 and status='PENDING' returning id",
    [applicationId, input.reviewerIdentityId, input.note],
  );
  if (approvedSteps.rowCount !== requiredSteps.rows.length) {
    throw new Error("Stakeholder application fixture did not approve every required hierarchy step");
  }

  const approvedApplication = await client.query<{ id: string }>(
    "update stakeholder_applications set status='APPROVED', reviewed_by_identity_id=$2, reviewed_at=clock_timestamp(), review_note=$3 where id=$1 and status='PENDING' returning id",
    [applicationId, input.reviewerIdentityId, input.note],
  );
  if (approvedApplication.rowCount !== 1) {
    throw new Error("Stakeholder application fixture did not reach APPROVED");
  }

  return applicationId;
}
