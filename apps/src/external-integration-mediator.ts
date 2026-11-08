import type { Pool } from "pg";
import { validateIntegrationEnvelope, type ExternalIntegrationEnvelope } from "./external-integration-contract.js";
import { withTenantTransaction } from "./tenant-db.js";
import type { AuthContext } from "./auth.js";

export async function acceptExternalIntegrationMessage(
  pool: Pool,
  auth: AuthContext,
  envelope: ExternalIntegrationEnvelope,
): Promise<{ accepted: boolean; duplicate: boolean; messageId: string }> {
  const validation = validateIntegrationEnvelope(envelope);
  if (!validation.ok) throw Object.assign(new Error(validation.error), { code: validation.code });

  if (!auth.activeOrganizationId || auth.activeOrganizationId !== envelope.organizationId) {
    throw Object.assign(new Error("Integration organization does not match the authenticated active organization"), { code: "ORG_FORBIDDEN" });
  }

  return withTenantTransaction(pool, auth, async client => {
    const existing = await client.query<{ id: string; status: string }>(
      "select id,status from external_integration_messages where integration_id=$1 and organization_id=$2 and idempotency_key=$3 for update",
      [envelope.integrationId, envelope.organizationId, envelope.idempotencyKey],
    );
    if (existing.rows[0]) {
      return { accepted: true, duplicate: true, messageId: existing.rows[0].id };
    }

    const inserted = await client.query<{ id: string }>(
      `insert into external_integration_messages
        (integration_id,contract_version,correlation_id,idempotency_key,organization_id,actor_identity_id,direction,kind,occurred_at,source_system,target_system,schema,payload,status)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ACCEPTED')
       returning id`,
      [
        envelope.integrationId,
        envelope.contractVersion,
        envelope.correlationId,
        envelope.idempotencyKey,
        envelope.organizationId,
        envelope.actorIdentityId ?? auth.identityId,
        envelope.direction,
        envelope.kind,
        envelope.occurredAt,
        envelope.sourceSystem,
        envelope.targetSystem,
        envelope.schema,
        envelope.payload,
      ],
    );

    return { accepted: true, duplicate: false, messageId: inserted.rows[0]!.id };
  });
}
