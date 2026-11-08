/**
 * Shakti external integration contract.
 *
 * This is a transport-neutral boundary for external government, PSU,
 * registry, DPI and ecosystem connectors. It deliberately contains no
 * provider-specific implementation.
 *
 * Authoritative state remains inside RupayKg. Adapters may submit commands
 * and observations, but an external response must never silently replace
 * authoritative internal state.
 */

export type IntegrationDirection = "INBOUND" | "OUTBOUND" | "BIDIRECTIONAL";
export type IntegrationMessageKind = "COMMAND" | "EVENT" | "OBSERVATION" | "RESPONSE";
export type IntegrationFailureClass =
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "VALIDATION"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "TRANSIENT"
  | "DUPLICATE"
  | "CONFLICT"
  | "REMOTE_REJECTION"
  | "UNKNOWN";

export interface ExternalIntegrationEnvelope {
  contractVersion: "1.0";
  integrationId: string;
  correlationId: string;
  idempotencyKey: string;
  organizationId: string;
  actorIdentityId?: string;
  direction: IntegrationDirection;
  kind: IntegrationMessageKind;
  occurredAt: string;
  sourceSystem: string;
  targetSystem: string;
  schema: string;
  payload: Record<string, unknown>;
}

export interface ExternalIntegrationResult {
  accepted: boolean;
  authoritativeMutation: boolean;
  correlationId: string;
  externalReference?: string;
  retryable: boolean;
  failureClass?: IntegrationFailureClass;
  message?: string;
}

export interface ExternalIntegrationAdapter {
  readonly integrationId: string;
  readonly contractVersion: "1.0";
  execute(envelope: ExternalIntegrationEnvelope): Promise<ExternalIntegrationResult>;
}

export function validateIntegrationEnvelope(
  envelope: ExternalIntegrationEnvelope,
): { ok: true } | { ok: false; code: string; error: string } {
  const required = [
    ["integrationId", envelope.integrationId],
    ["correlationId", envelope.correlationId],
    ["idempotencyKey", envelope.idempotencyKey],
    ["organizationId", envelope.organizationId],
    ["occurredAt", envelope.occurredAt],
    ["sourceSystem", envelope.sourceSystem],
    ["targetSystem", envelope.targetSystem],
    ["schema", envelope.schema],
  ] as const;

  for (const [name, value] of required) {
    if (typeof value !== "string" || !value.trim()) {
      return { ok: false, code: "INVALID_INTEGRATION_ENVELOPE", error: name + " is required" };
    }
  }

  if (envelope.contractVersion !== "1.0") {
    return { ok: false, code: "UNSUPPORTED_CONTRACT_VERSION", error: "contractVersion must be 1.0" };
  }

  if (!["INBOUND", "OUTBOUND", "BIDIRECTIONAL"].includes(envelope.direction)) {
    return { ok: false, code: "INVALID_DIRECTION", error: "direction is invalid" };
  }

  if (!["COMMAND", "EVENT", "OBSERVATION", "RESPONSE"].includes(envelope.kind)) {
    return { ok: false, code: "INVALID_MESSAGE_KIND", error: "kind is invalid" };
  }

  if (Number.isNaN(Date.parse(envelope.occurredAt))) {
    return { ok: false, code: "INVALID_OCCURRED_AT", error: "occurredAt must be an ISO date" };
  }

  if (!envelope.payload || typeof envelope.payload !== "object" || Array.isArray(envelope.payload)) {
    return { ok: false, code: "INVALID_PAYLOAD", error: "payload must be an object" };
  }

  return { ok: true };
}
