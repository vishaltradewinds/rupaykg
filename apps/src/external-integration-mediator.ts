import type { Pool } from "pg";
import { trace } from "@opentelemetry/api";
import { validateIntegrationEnvelope, type ExternalIntegrationEnvelope } from "./external-integration-contract.js";
import { withTenantTransaction } from "./tenant-db.js";
import type { AuthContext } from "./auth.js";

export async function acceptExternalIntegrationMessage(
  pool: Pool,
  auth: AuthContext,
  envelope: ExternalIntegrationEnvelope,
): Promise<{ accepted: boolean; duplicate: boolean; messageId: string; authoritativeMutation: true }> {
  const validation = validateIntegrationEnvelope(envelope);
  if (!validation.ok) throw Object.assign(new Error(validation.error), { code: validation.code });

  if (!auth.activeOrganizationId || auth.activeOrganizationId !== envelope.organizationId) {
    throw Object.assign(new Error("Integration organization does not match the authenticated active organization"), { code: "ORG_FORBIDDEN" });
  }
  if (envelope.actorIdentityId && envelope.actorIdentityId !== auth.identityId) {
    throw Object.assign(new Error("Integration actor identity does not match the authenticated identity"), { code: "ACTOR_FORBIDDEN" });
  }

  const tracer = trace.getTracer("rupaykg-integrations");
  return tracer.startActiveSpan("rupaykg.external_integration.accept", async span => {
    span.setAttribute("rupaykg.operation", "external_integration_accept");
    span.setAttribute("rupaykg.authoritative_mutation", true);
    try {
      return await withTenantTransaction(pool, auth, async client => {
    const existing = await client.query<{ id: string; status: string; payload: unknown; schema: string; kind: string; target_system: string; source_system: string }>(
      "select id,status,payload,schema,kind,target_system,source_system from external_integration_messages where integration_id=$1 and organization_id=$2 and idempotency_key=$3 for update",
      [envelope.integrationId, envelope.organizationId, envelope.idempotencyKey],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      const same = JSON.stringify(row.payload) === JSON.stringify(envelope.payload)
        && row.schema === envelope.schema
        && row.kind === envelope.kind
        && row.target_system === envelope.targetSystem
        && row.source_system === envelope.sourceSystem;
      if (!same) {
        throw Object.assign(new Error("Idempotency key was already used with a different integration message"), { code: "INTEGRATION_IDEMPOTENCY_CONFLICT" });
      }
      return { accepted: true, duplicate: true, messageId: row.id, authoritativeMutation: true as const };
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

    return { accepted: true, duplicate: false, messageId: inserted.rows[0]!.id, authoritativeMutation: true as const };
      });
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}
