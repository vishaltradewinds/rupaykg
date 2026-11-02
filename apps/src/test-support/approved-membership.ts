import type { Pool, PoolClient } from "pg";

type SqlExecutor = Pool | PoolClient;

/**
 * Create a test membership through the same governed onboarding lifecycle as production.
 * The disposable CI database must already contain its synthetic platform authority.
 */
export async function approveTestMembership(
  client: SqlExecutor,
  identityId: string,
  organizationId: string,
  roleId: string,
  geographyId: string,
  requestedRoleKey: string,
  requestedOrganizationType: string,
): Promise<void> {
  const authority = await client.query<{ id: string }>(
    "select i.id from public.identities i join public.organization_memberships om on om.identity_id=i.id and om.status='VERIFIED' join public.roles r on r.id=om.role_id and r.name='super_admin' join public.organizations o on o.id=om.organization_id and o.status='VERIFIED' where i.status='VERIFIED' and i.suspended_at is null order by i.created_at limit 1",
  );
  const reviewerId = authority.rows[0]?.id;
  if (!reviewerId) throw new Error("TEST_PLATFORM_AUTHORITY_NOT_BOOTSTRAPPED");

  const application = await client.query<{ id: string }>(
    "insert into public.stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id,status) values($1,$2,$3,$4,$5,$6,'PENDING') returning id",
    [identityId, organizationId, roleId, requestedRoleKey, requestedOrganizationType, geographyId],
  );
  const applicationId = application.rows[0]!.id;

  await client.query(
    "update public.stakeholder_application_approvals set status='APPROVED',approved_by_identity_id=$2,reviewed_at=clock_timestamp(),review_note='Synthetic CI integration fixture' where application_id=$1",
    [applicationId, reviewerId],
  );
  await client.query(
    "update public.stakeholder_applications set status='APPROVED',reviewed_by_identity_id=$2,reviewed_at=clock_timestamp() where id=$1",
    [applicationId, reviewerId],
  );
}
