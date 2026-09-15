import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const PANEL_ID = "rupaykg-operating-workflow";
const ORG_KEY = "rupaykg.activeOrganizationId";
type SessionAwareWindow = Window & { __rupaykgSessionToken?: string };
const sessionWindow = window as SessionAwareWindow;
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const response = await fetchOriginal(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes("/api/v1/auth/exchange")) response.clone().json().then((body: { sessionToken?: unknown }) => {
    if (typeof body?.sessionToken === "string" && body.sessionToken) {
      sessionWindow.__rupaykgSessionToken = body.sessionToken;
      window.dispatchEvent(new CustomEvent("rupaykg:session-ready"));
    }
  }).catch(() => undefined);
  if (url.includes("/api/v1/auth/logout")) sessionWindow.__rupaykgSessionToken = "";
  return response;
};

type Activity = { id: string; activity_type?: string; status?: string; occurred_at?: string | null; created_at?: string; geography_id?: string | null; geography_name?: string | null };
type Measurement = { id: string; activity_id: string; value?: string | number; unit?: string; method?: string | null; source?: string | null; measured_at?: string | null; quality_status?: string | null };
type Evidence = { id: string; activity_id: string; measurement_id?: string | null; evidence_type?: string; status?: string; captured_at?: string; content_uri?: string | null; content_hash?: string | null };
type Verification = { id: string; activity_id: string; evidence_id: string; decision?: string; scope?: string; decided_at?: string };
type Workspace = { data?: { activities?: Activity[]; measurements?: Measurement[]; evidence?: Evidence[]; verifications?: Verification[] } };
type Provenance = { guardian_status?: string; hcs_status?: string; guardian_execution_id?: string | null; hcs_consensus_timestamp?: string | null; integrity_hash?: string | null };
type Statutory = { profiles?: Array<Record<string, unknown>>; bwgAssessments?: Array<Record<string, unknown>>; eprApplicability?: Array<Record<string, unknown>> };
type Stage = { title: string; detail: string; target: string; status: "READY" | "PENDING" | "VERIFIED" | "CONFIRMED" | "BLOCKED" | "NOT_REACHED" };
const targets = ["rupaykg-field-capture", "resource-flow-intake", "resource-flow-intake", "mrv-provenance", "mrv-verification-actions", "mrv-provenance", "mrv-provenance", "value-lifecycle-management", "settlement-reconciliation-control"];
function esc(value: unknown): string { return String(value ?? "—").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] ?? c)); }
function orgId(): string { return localStorage.getItem(ORG_KEY)?.trim() ?? ""; }
function readSessionToken(): string { return sessionWindow.__rupaykgSessionToken ?? ""; }
function api<T>(path: string, token: string): Promise<T> { const headers = new Headers({ Accept: "application/json", Authorization: `Bearer ${token}` }); if (orgId()) headers.set("X-RupayKG-Organization-Id", orgId()); return fetch(path, { headers }).then(async (r) => { const body = await r.json().catch(() => ({})); if (!r.ok) throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${r.status})`); return body as T; }); }
function stagesFor(context: OperatingContext, activity: Activity | null, measurements: Measurement[], evidence: Evidence[], verifications: Verification[], provenance: Provenance[]): Stage[] {
  const id = activity?.id;
  const measured = measurements.some((m) => m.activity_id === id && Number(m.value) > 0);
  const evidenced = evidence.some((e) => e.activity_id === id && e.status === "VERIFIED" && (!!e.content_hash || !!e.content_uri));
  const approved = verifications.some((v) => v.activity_id === id && v.decision === "APPROVED");
  const guardian = provenance.some((p) => p.guardian_status === "VERIFIED" && !!p.guardian_execution_id);
  const hcs = provenance.some((p) => p.hcs_status === "CONSENSUS_CONFIRMED" && !!p.hcs_consensus_timestamp);
  const active = !!activity; const complete = activity?.status === "COMPLETED";
  return [
    { title: "1 · Capture", detail: context === "urban" ? "Ward-level MSW activity visible from the authorized field workflow." : "Village-level biomass activity visible from the authorized field workflow.", target: targets[0], status: active ? "READY" : "PENDING" },
    { title: context === "urban" ? "2 · Activity" : "2 · Aggregate", detail: context === "urban" ? "Authoritative activity remains bound to organization and geography scope." : "Rural aggregation remains tied to authorized producer/village geography.", target: targets[1], status: active ? "READY" : "PENDING" },
    { title: "3 · Measure", detail: "Positive measurement is required before downstream MRV.", target: targets[2], status: measured ? "VERIFIED" : active ? "PENDING" : "NOT_REACHED" },
    { title: "4 · Evidence", detail: "Evidence must be verified and carry a content hash or authoritative URI.", target: targets[3], status: evidenced ? "VERIFIED" : active ? "PENDING" : "NOT_REACHED" },
    { title: "5 · Verify", detail: "Authorized verification approval is separate from Guardian and HCS state.", target: targets[4], status: approved ? "VERIFIED" : active ? "PENDING" : "NOT_REACHED" },
    { title: "6 · Guardian MRV", detail: "Guardian requires completed activity, approved verification and verified evidence.", target: targets[5], status: guardian ? "VERIFIED" : complete && approved && evidenced ? "PENDING" : "BLOCKED" },
    { title: "7 · HCS Provenance", detail: "Consensus appears only when persisted HCS consensus evidence exists.", target: targets[6], status: hcs ? "CONFIRMED" : guardian ? "PENDING" : "BLOCKED" },
    { title: "8 · Value / Registry", detail: "Downstream eligibility is never inferred from a database write alone.", target: targets[7], status: hcs ? "READY" : "NOT_REACHED" },
    { title: "9 · Settlement", detail: "Settlement remains permissioned, separately authorized and reconciliation-controlled.", target: targets[8], status: hcs ? "READY" : "NOT_REACHED" },
  ];
}
function render(context: OperatingContext = readOperatingContext(), state?: { workspace?: Workspace; provenance: Provenance[]; statutory?: Statutory; message?: string }): void {
  const config = getOperatingContextConfig(context); const shell = document.querySelector(".app-shell") ?? document.body; let panel = document.getElementById(PANEL_ID);
  if (!panel) { panel = document.createElement("section"); panel.id = PANEL_ID; panel.setAttribute("aria-label", `${config.label} golden operating path`); shell.appendChild(panel); }
  Object.assign(panel.style, { margin: "12px 16px", padding: "16px", border: "1px solid rgba(87,211,255,.18)", borderRadius: "16px", background: "rgba(7,17,31,.96)", color: "#dbe7ef", font: "500 12px/1.45 system-ui,sans-serif" });
  const data = state?.workspace?.data; const activities = data?.activities ?? []; const activity = activities[0] ?? null; const stages = stagesFor(context, activity, data?.measurements ?? [], data?.evidence ?? [], data?.verifications ?? [], state?.provenance ?? []); const statutoryCount = (state?.statutory?.profiles?.length ?? 0) + (state?.statutory?.bwgAssessments?.length ?? 0) + (state?.statutory?.eprApplicability?.length ?? 0);
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-size:16px;font-weight:700">${esc(config.label)} Golden Operating Path</div><div style="opacity:.76;margin-top:3px">${esc(config.anchor)} · ${esc(config.unit)} · ${esc(config.waste)} · ${esc(config.geography)}</div></div><button id="rupaykg-golden-refresh" type="button" style="padding:7px 10px;border-radius:9px;border:1px solid rgba(87,211,255,.25);background:rgba(11,24,37,.9);color:#dbe7ef">Refresh authoritative state</button></div>${state?.message ? `<div role="alert" style="margin-top:10px;padding:9px;border-radius:9px;border:1px solid rgba(255,180,80,.25);background:rgba(255,180,80,.06)">${esc(state.message)}</div>` : ""}<div style="margin-top:10px;padding:10px;border-radius:10px;background:rgba(45,140,255,.08);border:1px solid rgba(45,140,255,.16)"><strong>Selected transaction:</strong> ${activity ? esc(activity.id) : "No authorized activity currently visible"} · ${activity ? esc(activity.status) : "PENDING"} · Geography ${activity ? esc(activity.geography_name || activity.geography_id) : "—"}<br><span style="opacity:.78">Statutory records visible: ${statutoryCount}. This surface is read-only; it does not create or approve regulatory state.</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:8px;margin-top:12px">${stages.map((step) => `<button type="button" data-target="${esc(step.target)}" style="text-align:left;padding:11px;border-radius:11px;border:1px solid rgba(87,211,255,.14);background:rgba(11,24,37,.78);color:#dbe7ef;cursor:pointer"><div style="font-weight:700">${esc(step.title)}</div><div style="margin-top:4px;opacity:.72;font-size:11px">${esc(step.detail)}</div><div style="margin-top:8px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">${esc(step.status.replaceAll("_", " "))}</div></button>`).join("")}</div><div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px"><div style="padding:10px;border-radius:10px;border:1px solid rgba(87,211,255,.12)"><strong>Regulatory gate</strong><div style="margin-top:4px;opacity:.75">${context === "urban" ? "SWM 2026 / BWG / EPR applicability where applicable" : "SWM 2026 rural local-body context / biomass-specific applicability where applicable"}</div></div><div style="padding:10px;border-radius:10px;border:1px solid rgba(87,211,255,.12)"><strong>Trust boundary</strong><div style="margin-top:4px;opacity:.75">Database state ≠ Guardian verification ≠ HCS consensus ≠ government issuance.</div></div></div><div style="margin-top:10px;padding:9px;border-radius:10px;background:rgba(45,140,255,.05);opacity:.82">No synthetic transaction state is generated. Missing authorization, evidence, verification, Guardian, HCS or external authority state remains pending/blocked/unavailable.</div>`;
  panel.querySelector("#rupaykg-golden-refresh")?.addEventListener("click", () => void load(context)); panel.querySelectorAll<HTMLButtonElement>("[data-target]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.target || "")?.scrollIntoView({ behavior: "smooth", block: "center" })));
}
let currentContext: OperatingContext = readOperatingContext();
async function load(context: OperatingContext = currentContext): Promise<void> {
  currentContext = context; const token = readSessionToken(); if (!token) { render(context, { provenance: [], message: "Sign in and establish an authorized organization session to view authoritative transaction state." }); return; }
  try { const workspace = await api<Workspace>("/api/v1/workspaces/mrv", token); const activity = workspace.data?.activities?.[0]; let provenance: Provenance[] = []; if (activity?.id) provenance = (await api<{ provenance?: Provenance[] }>(`/api/v1/mrv/provenance/${encodeURIComponent(activity.id)}`, token).catch(() => ({ provenance: [] }))).provenance ?? []; const statutory = await api<Statutory>("/api/v1/statutory/applicability", token).catch(() => undefined); render(context, { workspace, provenance, statutory }); }
  catch (error) { render(context, { provenance: [], message: error instanceof Error ? error.message : "Authoritative operating state unavailable." }); }
}
function mount(): void { render(currentContext, { provenance: [], message: "Loading authoritative transaction state…" }); void load(currentContext); window.addEventListener("rupaykg:operating-context-change", (event) => { currentContext = (event as CustomEvent<OperatingContext>).detail === "rural" ? "rural" : "urban"; void load(currentContext); }); window.addEventListener("rupaykg:session-ready", () => void load(currentContext)); window.addEventListener("storage", (event) => { if (event.key === ORG_KEY) void load(currentContext); }); window.setInterval(() => { if (readSessionToken()) void load(currentContext); }, 60000); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
