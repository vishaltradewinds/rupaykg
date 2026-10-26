/**
 * Domain contract for append-only waste custody events.
 *
 * This module validates event shape only. It does not grant access, prove legal
 * authorization, persist events, or assert that an event is true. API/database
 * enforcement, flow-party assignment, evidence verification and migrations remain
 * separate mandatory gates before any live workflow can use these contracts.
 */
export const WASTE_CUSTODY_EVENT_TYPES = [
  "GENERATOR_HANDOVER",
  "COLLECTOR_RECEIPT",
  "TRANSPORT_DISPATCH",
  "TRANSPORT_CHECKPOINT",
  "PROCESSOR_RECEIPT",
  "PARTIAL_ACCEPTANCE",
  "REJECTION",
  "QUANTITY_DISPUTE",
  "WEIGHMENT_CAPTURED",
  "PROCESSING_INPUT",
  "CORRECTION",
] as const;

export type WasteCustodyEventType = (typeof WASTE_CUSTODY_EVENT_TYPES)[number];
export type QuantityBasis = "DECLARED" | "ESTIMATED" | "MEASURED";

export interface WasteCustodyEventInput {
  readonly resourceFlowId: string;
  readonly idempotencyKey: string;
  readonly eventType: WasteCustodyEventType;
  readonly actorOrganizationId: string;
  readonly counterpartyOrganizationId?: string;
  readonly activityId?: string;
  readonly quantity: number;
  readonly unit: string;
  readonly quantityBasis: QuantityBasis;
  readonly quantitySource: string;
  readonly measurementMethod?: string;
  readonly instrumentId?: string;
  readonly occurredAt: string;
  readonly fromGeographyId?: string;
  readonly toGeographyId?: string;
  readonly evidenceIds?: readonly string[];
  readonly reasonCode?: string;
  readonly supersedesEventId?: string;
}

export type WasteCustodyValidation =
  | { readonly ok: true; readonly value: WasteCustodyEventInput }
  | { readonly ok: false; readonly code: string; readonly error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTERPARTY_REQUIRED: ReadonlySet<WasteCustodyEventType> = new Set([
  "GENERATOR_HANDOVER",
  "COLLECTOR_RECEIPT",
  "TRANSPORT_DISPATCH",
  "PROCESSOR_RECEIPT",
  "PARTIAL_ACCEPTANCE",
  "REJECTION",
  "QUANTITY_DISPUTE",
]);

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Unknown, malformed or unsupported event payloads fail closed with stable reason codes. */
export function validateWasteCustodyEvent(input: unknown): WasteCustodyValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "CUSTODY_EVENT_INVALID", error: "Custody event must be an object" };
  }
  const value = input as Partial<WasteCustodyEventInput>;
  if (!isUuid(value.resourceFlowId) || !isNonBlank(value.idempotencyKey) || value.idempotencyKey.length > 200) {
    return { ok: false, code: "CUSTODY_EVENT_IDENTITY_REQUIRED", error: "A valid resourceFlowId and an idempotencyKey of 1–200 characters are required" };
  }
  if (!WASTE_CUSTODY_EVENT_TYPES.includes(value.eventType as WasteCustodyEventType)) {
    return { ok: false, code: "CUSTODY_EVENT_TYPE_UNKNOWN", error: "Unknown custody event type must be reviewed" };
  }
  if (!isUuid(value.actorOrganizationId)) {
    return { ok: false, code: "CUSTODY_ACTOR_REQUIRED", error: "A valid actor organization is required" };
  }
  if (COUNTERPARTY_REQUIRED.has(value.eventType as WasteCustodyEventType) && !isUuid(value.counterpartyOrganizationId)) {
    return { ok: false, code: "CUSTODY_COUNTERPARTY_REQUIRED", error: "This custody event requires an explicitly identified counterparty" };
  }
  if (value.counterpartyOrganizationId !== undefined && !isUuid(value.counterpartyOrganizationId)) {
    return { ok: false, code: "CUSTODY_COUNTERPARTY_INVALID", error: "Counterparty organization must be a valid UUID" };
  }
  if (!Number.isFinite(value.quantity) || (value.quantity as number) <= 0 || !isNonBlank(value.unit)) {
    return { ok: false, code: "CUSTODY_QUANTITY_INVALID", error: "Quantity must be finite and positive and unit must be supplied" };
  }
  if (!["DECLARED", "ESTIMATED", "MEASURED"].includes(value.quantityBasis as string) || !isNonBlank(value.quantitySource)) {
    return { ok: false, code: "CUSTODY_QUANTITY_PROVENANCE_REQUIRED", error: "Quantity basis and source are required; declared or estimated values must not be represented as measured" };
  }
  if (value.eventType === "WEIGHMENT_CAPTURED" && value.quantityBasis !== "MEASURED") {
    return { ok: false, code: "CUSTODY_WEIGHMENT_MUST_BE_MEASURED", error: "A weighment event must record a measured quantity, not a declaration or estimate" };
  }
  if (value.quantityBasis === "MEASURED" && (!isNonBlank(value.measurementMethod) || !isNonBlank(value.instrumentId))) {
    return { ok: false, code: "CUSTODY_MEASUREMENT_PROVENANCE_REQUIRED", error: "Measured quantities require a method and instrument identifier" };
  }
  if (!isNonBlank(value.occurredAt) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.occurredAt) || Number.isNaN(Date.parse(value.occurredAt))) {
    return { ok: false, code: "CUSTODY_EVENT_TIME_INVALID", error: "Event timestamp must be a valid ISO timestamp with an explicit timezone" };
  }
  for (const key of ["activityId", "fromGeographyId", "toGeographyId", "supersedesEventId"] as const) {
    const candidate = value[key];
    if (candidate !== undefined && !isUuid(candidate)) {
      return { ok: false, code: "CUSTODY_REFERENCE_INVALID", error: key + " must be a valid UUID when supplied" };
    }
  }
  if (value.evidenceIds !== undefined && (!Array.isArray(value.evidenceIds) || value.evidenceIds.some((id) => !isUuid(id)))) {
    return { ok: false, code: "CUSTODY_EVIDENCE_REFERENCE_INVALID", error: "Evidence references must be an array of valid UUIDs" };
  }
  if (["PARTIAL_ACCEPTANCE", "REJECTION", "QUANTITY_DISPUTE", "CORRECTION"].includes(value.eventType as string) && !isNonBlank(value.reasonCode)) {
    return { ok: false, code: "CUSTODY_REASON_REQUIRED", error: "Partial acceptance, rejection, quantity disputes and corrections require a reason code" };
  }
  if (value.eventType === "CORRECTION" && !isUuid(value.supersedesEventId)) {
    return { ok: false, code: "CUSTODY_SUPERSESSION_REQUIRED", error: "A correction must reference the event it supersedes; history must not be overwritten" };
  }
  return { ok: true, value: value as WasteCustodyEventInput };
}
