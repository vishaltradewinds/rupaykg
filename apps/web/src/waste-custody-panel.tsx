import { useEffect, useMemo, useState, type FormEvent } from "react";

type Flow = {
  id: string;
  organization_id: string;
  organization_name?: string;
  origin_type?: string;
  resource_form?: string;
  material_code?: string;
  declared_quantity?: number | string;
  unit?: string;
  status?: string;
};
type Organization = { id: string; name: string; organization_type: string };
type CustodyEvent = {
  id: string;
  sequence_no: number;
  event_type: string;
  provenance_status: string;
  actor_organization_name?: string | null;
  counterparty_organization_name?: string | null;
  quantity: number | string;
  unit: string;
  quantity_basis?: string | null;
  quantity_source?: string | null;
  occurred_at?: string | null;
  recorded_at: string;
  reason_code?: string | null;
  event_hash?: string | null;
};
type ApiResponse<T> = T & { error?: string; code?: string };

const eventTypes = [
  "GENERATOR_HANDOVER", "COLLECTOR_RECEIPT", "AGGREGATOR_HANDOVER",
  "TRANSPORTER_ACCEPTANCE", "TRANSPORT_DISPATCH", "TRANSPORT_CHECKPOINT",
  "PROCESSOR_RECEIPT", "PARTIAL_ACCEPTANCE", "REJECTION", "QUANTITY_DISPUTE",
  "WEIGHMENT_CAPTURED", "PROCESSING_INPUT", "CORRECTION",
] as const;
const counterpartyRequired = new Set([
  "GENERATOR_HANDOVER", "COLLECTOR_RECEIPT", "AGGREGATOR_HANDOVER",
  "TRANSPORTER_ACCEPTANCE", "TRANSPORT_DISPATCH", "PROCESSOR_RECEIPT",
  "PARTIAL_ACCEPTANCE", "REJECTION", "QUANTITY_DISPUTE",
]);
const reasonRequired = new Set(["PARTIAL_ACCEPTANCE", "REJECTION", "QUANTITY_DISPUTE", "CORRECTION"]);

function localDateTimeNow(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function displayDate(value?: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function WasteCustodyPanel(props: {
  token: string;
  organizationId: string;
  permissions: string[];
  flows: Flow[];
}) {
  const { token, organizationId, permissions, flows } = props;
  const canRead = permissions.includes("waste:read");
  const canRecord = permissions.includes("waste:record");
  const [flowId, setFlowId] = useState("");
  const [events, setEvents] = useState<CustodyEvent[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [eventType, setEventType] = useState<string>("GENERATOR_HANDOVER");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [quantityBasis, setQuantityBasis] = useState("DECLARED");
  const [quantitySource, setQuantitySource] = useState("Operator declaration");
  const [measurementMethod, setMeasurementMethod] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [supersedesEventId, setSupersedesEventId] = useState("");
  const [occurredAt, setOccurredAt] = useState(localDateTimeNow());
  const [online, setOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedFlow = useMemo(() => flows.find(flow => flow.id === flowId) ?? null, [flows, flowId]);
  const correctionTargets = events.filter(event => event.provenance_status === "TYPED_APPEND_ONLY" && event.event_type !== "CORRECTION");
  const requiresCounterparty = counterpartyRequired.has(eventType);
  const requiresReason = reasonRequired.has(eventType);
  const measured = quantityBasis === "MEASURED" || eventType === "WEIGHMENT_CAPTURED";

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    if (!flows.length) {
      setFlowId("");
      setEvents([]);
      return;
    }
    if (!flowId || !flows.some(flow => flow.id === flowId)) setFlowId(flows[0]!.id);
  }, [flows, flowId]);

  useEffect(() => {
    setQuantity(selectedFlow?.declared_quantity == null ? "" : String(selectedFlow.declared_quantity));
    setUnit(selectedFlow?.unit || "kg");
  }, [selectedFlow?.id]);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
    headers.set("X-RupayKG-Organization-Id", organizationId);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    const body = await response.json().catch(() => ({})) as ApiResponse<T>;
    if (!response.ok) throw new Error(body.error || body.code || `Request failed (${response.status})`);
    return body;
  }

  async function refreshFlowData() {
    if (!flowId || !token) {
      setEvents([]);
      setOrganizations([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [history, directory] = await Promise.all([
        canRead
          ? request<{ events: CustodyEvent[] }>(`/api/v1/resource-flows/${encodeURIComponent(flowId)}/custody-events`)
          : Promise.resolve({ events: [] as CustodyEvent[] }),
        canRecord
          ? request<{ organizations: Organization[] }>(`/api/v1/resource-flows/${encodeURIComponent(flowId)}/custody-counterparties`)
          : Promise.resolve({ organizations: [] as Organization[] }),
      ]);
      setEvents(history.events ?? []);
      setOrganizations(directory.organizations ?? []);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load custody chain");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshFlowData(); }, [flowId, token, organizationId, canRead, canRecord]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFlow || !canRecord || !token) return;
    if (!online) { setError("This panel requires an online connection. Offline custody capture is not yet enabled here; no event has been queued."); return; }
    if (requiresCounterparty && !counterpartyId) {
      setError("Select the receiving or handing-over organization.");
      return;
    }
    if (requiresReason && !reasonCode.trim()) {
      setError("A reason code is required for partial acceptance, rejection, disputes and corrections.");
      return;
    }
    if (eventType === "CORRECTION" && !supersedesEventId) {
      setError("Choose the prior event being corrected. Original history will remain unchanged.");
      return;
    }
    if (measured && (!measurementMethod.trim() || !instrumentId.trim())) {
      setError("Measured quantities require both a measurement method and an instrument identifier.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    const idempotencyKey = `web:${crypto.randomUUID()}`;
    const payload = {
      idempotencyKey,
      eventType,
      actorOrganizationId: organizationId,
      ...(counterpartyId ? { counterpartyOrganizationId: counterpartyId } : {}),
      quantity: Number(quantity),
      unit: unit.trim(),
      quantityBasis: eventType === "WEIGHMENT_CAPTURED" ? "MEASURED" : quantityBasis,
      quantitySource: quantitySource.trim(),
      ...(measured ? { measurementMethod: measurementMethod.trim(), instrumentId: instrumentId.trim() } : {}),
      occurredAt: new Date(occurredAt).toISOString(),
      ...(reasonCode.trim() ? { reasonCode: reasonCode.trim() } : {}),
      ...(eventType === "CORRECTION" ? { supersedesEventId } : {}),
    };
    try {
      const result = await request<{ custodyEvent: { id: string; sequenceNo: number; eventHash: string }; replay?: boolean }>(
        `/api/v1/resource-flows/${encodeURIComponent(flowId)}/custody-events`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      setMessage(`Event saved · sequence ${result.custodyEvent.sequenceNo} · SHA-256 ${result.custodyEvent.eventHash.slice(0, 16)}…`);
      setReasonCode("");
      setSupersedesEventId("");
      await refreshFlowData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Custody event could not be saved");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="custody-panel">
      <div className="custody-panel-head">
        <div>
          <p className="eyebrow">MATERIAL MOVEMENT · APPEND-ONLY HISTORY</p>
          <h2>Chain of custody</h2>
          <p>Record a handover, receipt, transport checkpoint, weighment or processing input against an existing resource flow.</p>
        </div>
        <span className={canRecord ? "custody-badge enabled" : "custody-badge"}>{canRecord ? "Record permission" : "Read only"}</span>
      </div>
      {!canRead && <p className="custody-warning">Your organization lacks waste:read permission. Event history is not displayed.</p>}
      {!flows.length ? <p className="empty">Create or receive an authorized resource flow before recording custody events.</p> : <>
        <label className="custody-field"><span>Resource flow</span>
          <select value={flowId} onChange={e => setFlowId(e.target.value)}>
            {flows.map(flow => <option key={flow.id} value={flow.id}>{flow.material_code || "Material"} · {flow.declared_quantity ?? "—"} {flow.unit ?? ""} · {flow.id.slice(0, 8)}</option>)}
          </select>
        </label>
        {selectedFlow && <p className="custody-flow-context">{selectedFlow.origin_type ?? "Origin not specified"} · {selectedFlow.resource_form ?? "Form not specified"} · {selectedFlow.status ?? "Status unknown"}</p>}
        {canRecord && <form className="custody-form" onSubmit={submit}>
          <div className="custody-grid">
            <label className="custody-field"><span>Event</span>
              <select value={eventType} onChange={e => { const next = e.target.value; setEventType(next); if (next === "WEIGHMENT_CAPTURED") setQuantityBasis("MEASURED"); }}>
                {eventTypes.map(type => <option key={type} value={type}>{type.replaceAll("_", " ").toLowerCase()}</option>)}
              </select>
            </label>
            <label className="custody-field"><span>Counterparty{requiresCounterparty ? " · required" : ""}</span>
              <select value={counterpartyId} onChange={e => setCounterpartyId(e.target.value)} required={requiresCounterparty}>
                <option value="">Select organization</option>
                {organizations.map(org => <option key={org.id} value={org.id}>{org.name} · {org.organization_type}</option>)}
              </select>
            </label>
            <label className="custody-field"><span>Quantity</span><input type="number" min="0.000001" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} required /></label>
            <label className="custody-field"><span>Unit</span><input value={unit} onChange={e => setUnit(e.target.value)} required /></label>
            <label className="custody-field"><span>Quantity basis</span>
              <select value={eventType === "WEIGHMENT_CAPTURED" ? "MEASURED" : quantityBasis} onChange={e => setQuantityBasis(e.target.value)} disabled={eventType === "WEIGHMENT_CAPTURED"}>
                <option value="DECLARED">Declared</option><option value="ESTIMATED">Estimated</option><option value="MEASURED">Measured</option>
              </select>
            </label>
            <label className="custody-field"><span>Quantity source</span><input value={quantitySource} onChange={e => setQuantitySource(e.target.value)} required /></label>
            {measured && <>
              <label className="custody-field"><span>Measurement method</span><input value={measurementMethod} onChange={e => setMeasurementMethod(e.target.value)} required /></label>
              <label className="custody-field"><span>Instrument ID</span><input value={instrumentId} onChange={e => setInstrumentId(e.target.value)} required /></label>
            </>}
            {requiresReason && <label className="custody-field"><span>Reason code</span><input value={reasonCode} onChange={e => setReasonCode(e.target.value)} required placeholder="e.g. QUANTITY_MISMATCH" /></label>}
            {eventType === "CORRECTION" && <label className="custody-field"><span>Event to supersede</span>
              <select value={supersedesEventId} onChange={e => setSupersedesEventId(e.target.value)} required>
                <option value="">Select prior event</option>
                {correctionTargets.map(target => <option key={target.id} value={target.id}>#{target.sequence_no} · {target.event_type}</option>)}
              </select>
            </label>}
            <label className="custody-field"><span>When did it occur?</span><input type="datetime-local" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required /></label>
          </div>
          <div className="custody-actions"><button type="submit" disabled={submitting || loading || !online}>{submitting ? "Saving…" : "Record custody event"}</button><button type="button" className="secondary" onClick={() => void refreshFlowData()} disabled={loading}>{loading ? "Refreshing…" : "Refresh chain"}</button></div>
          <p className="custody-note">{online ? "" : "Offline: event submission is disabled; no custody event will be silently discarded or falsely marked as queued. " }Directory entries indicate verified platform membership and geography only. They do not prove material-specific permits, facility authorisation or EPR eligibility. The server rechecks permission and chain participation.</p>
        </form>}
        {message && <p className="custody-success" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {canRead && <div className="custody-history">
          <div className="section-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h3>Recorded events</h3></div><span>{events.length} records</span></div>
          {loading && <p className="empty">Loading authoritative custody history…</p>}
          {!loading && !events.length && <p className="empty">No custody events have been recorded for this flow.</p>}
          {events.slice(-40).map(item => <article className="custody-event" key={item.id}>
            <div className="custody-event-top"><strong>#{item.sequence_no} · {item.event_type.replaceAll("_", " ")}</strong><span>{item.provenance_status === "TYPED_APPEND_ONLY" ? "APPEND-ONLY" : "LEGACY · UNVERIFIED PROVENANCE"}</span></div>
            <p>{item.quantity} {item.unit} · {item.quantity_basis ?? "basis unknown"} · {item.actor_organization_name ?? "Actor not recorded"}{item.counterparty_organization_name ? ` → ${item.counterparty_organization_name}` : ""}</p>
            <small>Occurred: {displayDate(item.occurred_at)} · Recorded: {displayDate(item.recorded_at)}</small>
            {item.reason_code && <small>Reason: {item.reason_code}</small>}
            {item.event_hash && <small>Event SHA-256: {item.event_hash}</small>}
          </article>)}
        </div>}
      </>}
    </section>
  );
}
