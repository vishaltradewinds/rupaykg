import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const PANEL_ID = "rupaykg-operating-workflow";
const ORG_KEY = "rupaykg.activeOrganizationId";

type Activity = { id: string; activity_type?: string; status?: string; occurred_at?: string | null; created_at?: string; geography_id?: string | null; geography_name?: string | null };
type Measurement = { id: string; activity_id: string; value?: string | number; unit?: string; method?: string | null; source?: string | null; measured_at?: string | null; quality_status?: string | null };
type Evidence = { id: string; activity_id: string; measurement_id?: string | null; evidence_type?: string; status?: string; captured_at?: string; content_uri?: string | null; content_hash?: string | null };
type Verification = { id: string; activity_id: string; evidence_id: string; decision?: string; scope?: string; decided_at?: string };
type Workspace = { data?: { activities?: Activity[]; measurements?: Measurement[]; evidence?: Evidence[]; verifications?: Verification[] } };
type Provenance = { guardian_status?: string; hcs_status?: string; guardian_execution_id?: string | null; hcs_consensus_timestamp?: string | null; integrity_hash?: string | null };
type Statutory = { profiles?: Array<Record<string, unknown>>; bwgAssessments?: Array<Record<string, unknown>>; eprApplicability?: Array<Record<string, unknown>> };

type Stage = { title: string; detail: string; target: string; status: "READY" | "PENDING" | "VERIFIED" | "CONFIRMED" | "BLOCKED" | "NOT_REACHED" };

const commonTargets = [
  "rupaykg-field-capture",
  "resource-flow-intake",
  "resource-flow-intake",
  "mrv-provenance",
  "mrv-verification-actions",
  "mrv-provenance",
  "mrv-provenance",
  "value-lifecycle-management",
  "settlement-reconciliation-control",
];

function esc(value: unknown): string { return String(value ?? "—").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] ?? c)); }
function orgId(): string { return localStorage.getItem(ORG_KEY)?.trim() ?? ""; }
function badge(status: Stage["status"]): string { return status.replaceAll("_", " "); }

async function api<T>(path: string, token: string): Promise<T> {
  const headers = new Headers({ Accept: "application/json", Authorization: `Bearer ${token}` });
  if (orgId()) headers.set("X-RupayKG-Organization-Id", orgId());
  const response = await fetch(path, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${response.status})`);
  return body as T;
}

function readSessionToken(): string {
  // The existing application intentionally keeps its opaque session token in memory.
  // This panel therefore listens for the session-ready event instead of creating its own auth/session storage.
  return (window as Window & { __rupaykgSessionToken?: string }).__rupaykgSessionToken ?? "";
}

function stagesFor(context: OperatingContext, activity: Activity | null, measurements: Measurement[], evidence: Evidence[], verifications: Verification[], provenance: Provenance[]): Stage[] {
  const measured = measurements.some((m) => m.activity_id === activity?.id && Number(m.value) > 0);
  const evidenced = evidence.some((e) => e.activity_id === activity?.id && e.status === "VERIFIED" && (!!e.content_hash || !!e.content_uri));
  const approved = verifications.some((v) => v.activity_id === activity?.id && v.decision === "APPROVED");
  const guardian = provenance.some((p) => p.guardian_status === "VERIFIED" && !!p.guardian_execution_id);
  const hcs = provenance.some((p) => p.hcs_status === "CONSENSUS_CONFIRMED" && !!p.hcs_consensus_timestamp);
  const active = !!activity;
  const complete = activity?.status === "COMPLETED";
  const captureDetail = context === "urban" ? "Ward-level MSW activity" : "Village-level biomass activity";
  return [
    { title: "1 · Capture", detail: `${captureDetail} recorded through the existing authorized field workflow.`, target: commonTargets[0], status: active ? "READY" : "PENDING" },
    { title: context === "urban" ? "2 · Activity" : "2 · Aggregate", detail: context === "urban" ? "Authoritative activity exists within the organization/geography scope." : "Rural aggregation remains tied to authorized producer/village geography.", target: commonTargets[1], status: active ? "READY" : "PENDING" },
    { title: "3 · Measure", detail: "A positive measurement is required before downstream MRV.", target: commonTargets[2], status: measured ? "VERIFIED" : active ? "PENDING" : "NOT_REACHED" },
    { title: "4 · Evidence", detail: "Evidence must be verified and carry a content hash or authoritative URI.", target: commonTargets[3], status: evidenced ? "VERIFIED" : active ? "PENDING" : "NOT_REACHED" },
    { title: "5 · Verify", detail: "Authorized verification approval is separate from Guardian and HCS state.", target: commonTargets[4], status: approved ? "VERIFIED" : active ? "PENDING" : "NOT_REACHED" },
    { title: "6 · Guardian MRV", detail: "Guardian can run only after completed activity, approved verification and verified evidence.", target: commonTargets[5], status: guardian ? "VERIFIED" : complete && approved && evidenced ? "PENDING" : "BLOCKED" },
    { title: "7 · HCS Provenance", detail: "Consensus is shown only when a persisted HCS consensus record exists.", target: commonTargets[6], status: hcs ? "CONFIRMED" : guardian ? "PENDING" : "BLOCKED" },
    { title: "8 · Value / Registry", detail: "Eligibility is downstream of verified MRV/provenance; this surface never fabricates a certificate.", target: commonTargets[7], status: hcs ? "READY" : "NOT_REACHED" },
    { title: "9 · Settlement", detail: "Settlement remains permissioned, separately authorized and reconciliation-controlled.", target: commonTargets[8], status: hcs ? "READY" : "NOT_REACHED" },
  ];
}

function render(context: OperatingContext = readOperatingContext(), state?: { token: string; workspace?: Workspace; provenance: Provenance[]; statutory?: Statutory; message?: string }): void {
  const config = getOperatingContextConfig(context);
  const shell = document.querySelector(".app-shell") ?? document.body;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("section"); panel.id = PANEL_ID; panel.setAttribute("aria-label", `${config.label} golden operating path`); shell.appendChild(panel);
  }
  Object.assign(panel.style, { margin: "12px 16px", padding: "16px", border: "1px solid rgba(87,211,255,.18)", borderRadius: "16px", background: "rgba(7,17,31,.96)", color: "#dbe7ef", font: "500 12px/1.45 system-ui,sans-serif" });
  const data = state?.workspace?.data;
  const activities = data?.activities ?? [];
  const activity = activities[0] ?? null;
  const measurements = data?.measurements ?? [];
  const evidence = data?.evidence ?? [];
  const verifications = data?.verifications ?? [];
  const stages = stagesFor(context, activity, measurements, evidence, verifications, state?.provenance ?? []);
  const statutoryCount = (state?.statutory?.profiles?.length ?? 0) + (state?.statutory?.bwgAssessments?.length ?? 0) + (state?.statutory?.eprApplicability?.length ?? 0);
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-size:16px;font-weight:700">${esc(config.label)} Golden Operating Path</div><div style="opacity:.76;margin-top:3px">${esc(config.anchor)} · ${esc(config.unit)} · ${esc(config.waste)} · ${esc(config.geography)}</div></div><button id="rupaykg-golden-refresh" type="button" style="padding:7px 10px;border-radius:9px;border:1px solid rgba(87,211,255,.25);background:rgba(11,24,37,.9);color:#dbe7ef">Refresh authoritative state</button></div>${state?.message ? `<div role="alert" style="margin-top:10px;padding:9px;border-radius:9px;border:1px solid rgba(255,180,80,.25);background:rgba(255,180,80,.06)">${esc(state.message)}</div>` : ""}<div style="margin-top:10px;padding:10px;border-radius:10px;background:rgba(45,140,255,.08);border:1px solid rgba(45,140,255,.16)"><strong>Selected transaction:</strong> ${activity ? esc(activity.id) : "No authorized activity currently visible"} · ${activity ? esc(activity.status) : "PENDING"} · Geography ${activity ? esc(activity.geography_name || activity.geography_id) : "—"}<br><span style="opacity:.78">Statutory records visible: ${statutoryCount}. This is a read-only operating status surface; it does not create or approve regulatory state.</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:8px;margin-top:12px">${stages.map((step) => `<button type="button" data-target="${esc(step.target)}" style="text-align:left;padding:11px;border-radius:11px;border:1px solid rgba(87,211,255,.14);background:rgba(11,24,37,.78);color:#dbe7ef;cursor:pointer"><div style="font-weight:700">${esc(step.title)}</div><div style="margin-top:4px;opacity:.72;font-size:11px">${esc(step.detail)}</div><div style="margin-top:8px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">${esc(badge(step.status))}</div></button>`).join("")}</div><div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px"><div style="padding:10px;border-radius:10px;border:1px solid rgba(87,211,255,.12)"><strong>Regulatory gate</strong><div style="margin-top:4px;opacity:.75">${context === "urban" ? "SWM 2026 / BWG / EPR applicability where applicable" : "SWM 2026 rural local-body context / biomass-specific applicability where applicable"}</div></div><div style="padding:10px;border-radius:10px;border:1px solid rgba(87,211,255,.12)"><strong>Trust boundary</strong><div style="margin-top:4px;opacity:.75">Database state ≠ Guardian verification ≠ HCS consensus ≠ government issuance.</div></div></div><div style="margin-top:10px;padding:9px;border-radius:10px;background:rgba(45,140,255,.05);opacity:.82">No synthetic transaction state is generated here. Missing authorization, evidence, verification, Guardian, HCS or external authority state remains visible as pending/blocked/unavailable.</div>`;
  panel.querySelector("#rupaykg-golden-refresh")?.addEventListener("click", () => void load(context));
  panel.querySelectorAll<HTMLButtonElement>("[data-target]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.target || "")?.scrollIntoView({ behavior: "smooth", block: "center" })));
}

let currentContext: OperatingContext = readOperatingContext();
async function load(context: OperatingContext = currentContext): Promise<void> {
  currentContext = context;
  const token = readSessionToken();
  if (!token) { render(context, { token: "", provenance: [], message: "Sign in and establish an authorized organization session to view authoritative transaction state." }); return; }
  try {
    const workspace = await api<Workspace>("/api/v1/workspaces/mrv", token);
    const activities = workspace.data?.activities ?? [];
    const activity = activities[0];
    let provenance: Provenance[] = [];
    if (activity?.id) {
      const response = await api<{ provenance?: Provenance[] }>(`/api/v1/mrv/provenance/${encodeURIComponent(activity.id)}`, token).catch(() => ({ provenance: [] }));
      provenance = response.provenance ?? [];
    }
    const statutory = await api<Statutory>("/api/v1/statutory/applicability", token).catch(() => undefined);
    render(context, { token, workspace, provenance, statutory });
  } catch (error) {
    render(context, { token, provenance: [], message: error instanceof Error ? error.message : "Authoritative operating state unavailable." });
  }
}

function mount(): void {
  render(currentContext, { token: "", provenance: [], message: "Loading authoritative transaction state…" });
  void load(currentContext);
  window.addEventListener("rupaykg:operating-context-change", (event) => { currentContext = (event as CustomEvent<OperatingContext>).detail === "rural" ? "rural" : "urban"; void load(currentContext); });
  window.addEventListener("rupaykg:session-ready", () => void load(currentContext));
  window.addEventListener("storage", (event) => { if (event.key === ORG_KEY) void load(currentContext); });
  window.setInterval(() => { if (readSessionToken()) void load(currentContext); }, 60000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
