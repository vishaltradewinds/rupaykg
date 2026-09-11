import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { initializeApp } from "firebase/app";
import "./styles.css";

type Obligation = {
  id: string;
  organization_id: string;
  organization_name: string;
  jurisdiction_id: string | null;
  jurisdiction_name: string | null;
  obligation_type: string;
  period_start: string;
  period_end: string;
  required_quantity: number | string;
  status: string;
};
type RegulatorySource = { authority: string; title: string; instrument: string; source_url: string; verified_on: string; status: string; affected_module: string; notes: string };
type Membership = { organization_id: string; status: string; can_assess_epr?: boolean; permissions?: string[] };
type Me = { memberships: Membership[] };
type PanelState = { status: string; message: string; obligations: Obligation[]; canAssess: boolean; eprSource: RegulatorySource | null };
const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const firebaseAuth = firebaseConfigured ? getAuth(initializeApp(firebaseConfig, "compliance-assessment")) : null;
const root = document.getElementById("compliance-assessment");
async function api<T>(path: string, token = "", init: RequestInit = {}): Promise<T> { const headers = new Headers(init.headers); headers.set("Accept", "application/json"); if (token) headers.set("Authorization", `Bearer ${token}`); const response = await fetch(path, { ...init, headers }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`); return body as T; }
function text(value: unknown) { return value === null || value === undefined || value === "" ? "—" : String(value); }
function escapeHtml(value: unknown) { return text(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character); }
function safeHttpUrl(value: unknown) { try { const url = new URL(String(value)); return url.protocol === "https:" ? url.toString() : null; } catch { return null; } }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
function selectedOrganizationId(): string { return window.localStorage.getItem("rupaykg.activeOrganizationId")?.trim() ?? ""; }
function selectMembership(me: Me): Membership | null { const verified = me.memberships.filter((candidate) => candidate.status === "VERIFIED"); const selected = selectedOrganizationId(); return verified.find((candidate) => candidate.organization_id === selected) ?? verified[0] ?? null; }
if (root && firebaseAuth) {
  const render = (state: PanelState) => {
    const rows = state.obligations.length ? state.obligations.map((obligation) => `<article class="compliance-row"><div><strong>${escapeHtml(obligation.obligation_type)}</strong><span>${escapeHtml(obligation.organization_name)} · ${escapeHtml(obligation.jurisdiction_name)} · ${escapeHtml(formatDate(obligation.period_start))} – ${escapeHtml(formatDate(obligation.period_end))}</span><small>Status: ${escapeHtml(obligation.status)} · Required quantity: ${escapeHtml(obligation.required_quantity)}</small></div>${state.canAssess ? `<button data-assess="${escapeHtml(obligation.id)}">Assess obligation</button>` : `<span class="field-help">Assessment permission not granted</span>`}</article>`).join("") : `<div class="empty">No authorized obligations are available for assessment.</div>`;
    const sourceUrl = safeHttpUrl(state.eprSource?.source_url);
    const sourceContext = state.eprSource ? `<aside class="compliance-source"><div><p class="eyebrow">CURRENT CPCB SOURCE</p><strong>${escapeHtml(state.eprSource.title)}</strong><span>${escapeHtml(state.eprSource.authority)} · verified ${escapeHtml(formatDate(state.eprSource.verified_on))}</span></div>${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Open official portal</a>` : ""}</aside>` : `<div class="field-help">Current CPCB EPR source is not available from the authoritative regulatory catalog.</div>`;
    root.innerHTML = `<section class="compliance-card"><div class="compliance-head"><div><p class="eyebrow">AUTHORITATIVE COMPLIANCE</p><h2>EPR obligation assessment</h2><p>Assess an existing obligation through the production API. No quantities or obligation state are synthesized in the browser.</p></div><span class="compliance-state">${escapeHtml(state.status)}</span></div>${state.message ? `<div class="resource-flow-state">${escapeHtml(state.message)}</div>` : ""}${sourceContext}<div class="compliance-list">${rows}</div></section>`;
    root.querySelectorAll<HTMLButtonElement>("[data-assess]").forEach((button) => button.addEventListener("click", () => void assess(button.dataset.assess!, state)));
  };
  const assess = async (id: string, state: PanelState) => {
    const button = root.querySelector<HTMLButtonElement>(`[data-assess="${id}"]`); if (button) button.disabled = true;
    try {
      const user = firebaseAuth.currentUser; if (!user || !user.emailVerified) throw new Error("Verified Firebase sign-in is required.");
      const idToken = await user.getIdToken(true); const session = await api<{ sessionToken: string }>("/api/v1/auth/exchange", "", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
      const me = await api<Me>("/api/v1/auth/me", session.sessionToken); const membership = selectMembership(me); if (!membership) throw new Error("A verified organization membership is required.");
      if (membership.can_assess_epr !== true) throw new Error("EPR assessment permission is not granted for the active organization membership.");
      const result = await api<{ assessment?: { status?: string; requiredQuantity?: number | string } }>(`/api/v1/epr/obligations/${id}/assess`, session.sessionToken, { method: "POST" });
      state.message = `Authoritative assessment completed: ${text(result.assessment?.status)} · required quantity ${text(result.assessment?.requiredQuantity)}`;
      const workspace = await api<{ data: { obligations: Obligation[] } }>("/api/v1/workspaces/compliance", session.sessionToken); state.obligations = workspace.data.obligations ?? []; state.status = "READY";
    } catch (error) { state.message = error instanceof Error ? error.message : "Compliance assessment failed."; }
    render(state);
  };
  const load = async (user: User) => {
    try {
      if (!user.emailVerified) throw new Error("Verify your email address before using compliance assessment.");
      const idToken = await user.getIdToken(true); const session = await api<{ sessionToken: string }>("/api/v1/auth/exchange", "", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
      const me = await api<Me>("/api/v1/auth/me", session.sessionToken); const membership = selectMembership(me); if (!membership) throw new Error("A verified organization membership is required.");
      const [workspace, sources] = await Promise.all([api<{ data: { obligations: Obligation[] } }>("/api/v1/workspaces/compliance", session.sessionToken), api<{ sources: RegulatorySource[] }>("/api/v1/regulatory/sources")]);
      const eprSource = (sources.sources ?? []).find((source) => source.affected_module === "compliance" && source.title.toLowerCase().includes("common epr portal") && source.status === "IN_FORCE") ?? null;
      render({ status: "READY", message: membership.can_assess_epr === true ? "Assessments use authoritative obligation and verified-credit records." : "Compliance obligations are visible, but EPR assessment permission is not granted.", obligations: workspace.data.obligations ?? [], canAssess: membership.can_assess_epr === true, eprSource });
    } catch (error) { render({ status: "UNAVAILABLE", message: error instanceof Error ? error.message : "Unable to load authoritative compliance data.", obligations: [], canAssess: false, eprSource: null }); }
  };
  onAuthStateChanged(firebaseAuth, (user) => { if (user) void load(user); else render({ status: "SIGN IN REQUIRED", message: "Sign in to load authorized compliance obligations.", obligations: [], canAssess: false, eprSource: null }); });
  document.querySelector<HTMLSelectElement>('select[aria-label="Active organization"]')?.addEventListener("change", () => { const user = firebaseAuth.currentUser; if (user) void load(user); });
  window.addEventListener("storage", (event) => { if (event.key === "rupaykg.activeOrganizationId") { const user = firebaseAuth.currentUser; if (user) void load(user); } });
}
// Keep the authoritative compliance panel on the push-CI path so the complete production gate runs.
