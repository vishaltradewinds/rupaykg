import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { approveTestMembership } from "./test-support/approved-membership.js";

const databaseUrl = process.env.DATABASE_URL;
const ssl = process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false };

test("verifier authorization is active-identity and subject-tenant scoped for every decision", { skip: !databaseUrl }, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl });
  const client = await pool.connect();

  const expectRejected = async (name: string, action: () => Promise<unknown>, pattern: RegExp) => {
    await client.query(`SAVEPOINT ${name}`);
    try {
      await assert.rejects(action(), pattern);
    } finally {
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      await client.query(`RELEASE SAVEPOINT ${name}`);
    }
  };

  const insertEvidence = async (activityId: string, suffix: string): Promise<string> => {
    const measurement = await client.query<{ id: string }>(
      "insert into public.measurements(activity_id,value,unit,method,source,measured_at,quality_status) values($1,1,'kg','TEST','FIELD',now(),'VERIFIED') returning id",
      [activityId],
    );
    const evidence = await client.query<{ id: string }>(
      "insert into public.evidence(activity_id,measurement_id,evidence_type,status,captured_at,content_hash) values($1,$2,'TEST_RECORD','VERIFIED',now(),$3) returning id",
      [activityId, measurement.rows[0]!.id, `verifier-test-${suffix}`],
    );
    return evidence.rows[0]!.id;
  };

  const insertVerification = async (activityId: string, evidenceId: string, verifierId: string, decision = "APPROVED") =>
    client.query(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,$4,'tenant-security-test','synthetic CI test')",
      [evidenceId, activityId, verifierId, decision],
    );

  try {
    await client.query("BEGIN");
    const triggerBinding = await client.query<{ function_name: string }>(
      "select p.proname as function_name from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid='public.verifications'::regclass and t.tgname='verifications_integrity_guard' and not t.tgisinternal",
    );
    assert.equal(triggerBinding.rows[0]?.function_name, "prevent_invalid_verification", "tenant authorization must be enforced by the function actually bound to verifications_integrity_guard");
    const suffix = randomUUID();
    const orgA = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values($1,'COLLECTOR','VERIFIED') returning id",
      [`Verifier Tenant A ${suffix}`],
    )).rows[0]!.id;
    const orgB = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values($1,'COLLECTOR','VERIFIED') returning id",
      [`Verifier Tenant B ${suffix}`],
    )).rows[0]!.id;
    const geoA = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      [`VTA-${suffix}`, `Verifier Geography A ${suffix}`],
    )).rows[0]!.id;
    const geoB = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      [`VTB-${suffix}`, `Verifier Geography B ${suffix}`],
    )).rows[0]!.id;

    const actorId = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,'Verifier Test Activity Actor','VERIFIED') returning id",
      [`verifier-actor-${suffix}`],
    )).rows[0]!.id;
    const verifierA = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,'Same Tenant Verifier','VERIFIED') returning id",
      [`verifier-a-${suffix}`],
    )).rows[0]!.id;
    const verifierB = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,'Foreign Tenant Verifier','VERIFIED') returning id",
      [`verifier-b-${suffix}`],
    )).rows[0]!.id;
    const roleA = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions) values($1,'verifier',$2::jsonb) returning id",
      [orgA, JSON.stringify(["verification:approve", "VERIFY_EVIDENCE"])],
    )).rows[0]!.id;
    const roleB = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions) values($1,'verifier',$2::jsonb) returning id",
      [orgB, JSON.stringify(["verification:approve", "VERIFY_EVIDENCE"])],
    )).rows[0]!.id;

    await approveTestMembership(client, verifierA, orgA, roleA, geoA, "verifier", "collector");
    await approveTestMembership(client, verifierB, orgB, roleB, geoB, "verifier", "collector");

    const activityA = (await client.query<{ id: string }>(
      "insert into public.activities(organization_id,actor_identity_id,geography_id,activity_type,status,completed_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id",
      [orgA, actorId, geoA],
    )).rows[0]!.id;
    const evidenceA = await insertEvidence(activityA, suffix);

    // Negative: a verifier-like role label without an explicit permission is not authority.
    const labelOnlyRole = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions) values($1,'auditor','[]'::jsonb) returning id",
      [orgA],
    )).rows[0]!.id;
    const labelOnlyVerifier = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,'Role Label Only Verifier','VERIFIED') returning id",
      [`verifier-label-only-${suffix}`],
    )).rows[0]!.id;
    await approveTestMembership(client, labelOnlyVerifier, orgA, labelOnlyRole, geoA, "auditor", "collector", false);
    await expectRejected("role_label_without_permission", () => insertVerification(activityA, evidenceA, labelOnlyVerifier), /verifier must be active|verification requires verified authority/i);

    // Positive: a verified, active verifier in the subject tenant and geography.
    await insertVerification(activityA, evidenceA, verifierA);

    // Negative: membership in another tenant cannot authorize this subject activity.
    await expectRejected("foreign_tenant", () => insertVerification(activityA, evidenceA, verifierB), /verifier must be active|verification requires verified authority/i);
    // The legacy trigger also applies to non-APPROVED decisions; preserve that rule.
    await expectRejected("foreign_tenant_rejected", () => insertVerification(activityA, evidenceA, verifierB, "REJECTED"), /verifier must be active|verification requires verified authority/i);
    await insertVerification(activityA, evidenceA, verifierA, "REJECTED");

    const suspendedVerifier = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,'Suspended Verifier','VERIFIED') returning id",
      [`verifier-suspended-${suffix}`],
    )).rows[0]!.id;
    await approveTestMembership(client, suspendedVerifier, orgA, roleA, geoA, "verifier", "collector");
    await client.query("update public.identities set suspended_at=now() where id=$1", [suspendedVerifier]);
    await expectRejected("suspended_identity", () => insertVerification(activityA, evidenceA, suspendedVerifier), /verifier must be active|verification requires verified authority/i);

    const pendingVerifier = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,'Unverified Verifier','VERIFIED') returning id",
      [`verifier-pending-${suffix}`],
    )).rows[0]!.id;
    await approveTestMembership(client, pendingVerifier, orgA, roleA, geoA, "verifier", "collector");
    await client.query("update public.identities set status='PENDING' where id=$1", [pendingVerifier]);
    await expectRejected("unverified_identity", () => insertVerification(activityA, evidenceA, pendingVerifier), /verifier must be active|verification requires verified authority/i);

    const pendingMembershipVerifier = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,'Pending Membership Verifier','VERIFIED') returning id",
      [`verifier-membership-pending-${suffix}`],
    )).rows[0]!.id;
    await approveTestMembership(client, pendingMembershipVerifier, orgA, roleA, geoA, "verifier", "collector");
    await client.query(
      "update public.organization_memberships set status='PENDING' where identity_id=$1 and organization_id=$2 and role_id=$3",
      [pendingMembershipVerifier, orgA, roleA],
    );
    await expectRejected("pending_membership", () => insertVerification(activityA, evidenceA, pendingMembershipVerifier), /verifier must be active|verification requires verified authority/i);

    await client.query("update public.organizations set status='PENDING' where id=$1", [orgA]);
    await expectRejected("unverified_organization", () => insertVerification(activityA, evidenceA, verifierA), /verifier must be active|verification requires verified authority/i);
    await client.query("update public.organizations set status='VERIFIED' where id=$1", [orgA]);

    await client.query(
      "update public.organization_geography_scopes set status='PENDING' where organization_id=$1 and geography_id=$2",
      [orgA, geoA],
    );
    await expectRejected("pending_geography_scope", () => insertVerification(activityA, evidenceA, verifierA), /verifier must be active|verification requires verified authority/i);

    await client.query("update public.organization_geography_scopes set status='VERIFIED' where organization_id=$1 and geography_id=$2", [orgA, geoA]);

    const selfActivity = (await client.query<{ id: string }>(
      "insert into public.activities(organization_id,actor_identity_id,geography_id,activity_type,status,completed_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id",
      [orgA, verifierA, geoA],
    )).rows[0]!.id;
    const selfEvidence = await insertEvidence(selfActivity, `self-${suffix}`);
    await expectRejected("self_verification", () => insertVerification(selfActivity, selfEvidence, verifierA), /self-approve|cannot verify its own/i);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
});
