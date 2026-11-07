import type { Pool, PoolClient } from "pg";

type SqlExecutor = Pool | PoolClient;

/**
 * Approve the governed application required before a test membership is inserted.
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

  // Seed the same pending records that production onboarding activates.
  // The fixture then applies the terminal state transitions performed by
  // auth_private.review_stakeholder_application after its approval chain ends.
  await client.query(
    "insert into public.organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'PENDING')",
    [identityId, organizationId, roleId],
  );
  await client.query(
    "insert into public.organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'PENDING') on conflict do nothing",
    [organizationId, geographyId],
  );
  await client.query(
    "update public.stakeholder_application_approvals set status='APPROVED',approved_by_identity_id=$2,reviewed_at=clock_timestamp(),review_note='Synthetic CI integration fixture' where application_id=$1",
    [applicationId, reviewerId],
  );
  await client.query(
    "update public.stakeholder_applications set status='APPROVED',reviewed_by_identity_id=$2,reviewed_at=clock_timestamp() where id=$1",
    [applicationId, reviewerId],
  );
  await client.query(
    "update public.organizations set status='VERIFIED',verification_status='VERIFIED',verified_by_identity_id=case when verification_status='VERIFIED' then verified_by_identity_id else $2 end,verified_at=case when verification_status='VERIFIED' then verified_at else clock_timestamp() end where id=$1 and (status is distinct from 'VERIFIED' or verification_status is distinct from 'VERIFIED')",
    [organizationId, reviewerId],
  );
  await client.query(
    "update public.organization_memberships set status='VERIFIED' where identity_id=$1 and organization_id=$2 and role_id=$3 and status='PENDING'",
    [identityId, organizationId, roleId],
  );
  await client.query(
    "update public.organization_geography_scopes set status='VERIFIED' where organization_id=$1 and geography_id=$2 and status='PENDING'",
    [organizationId, geographyId],
  );
}
