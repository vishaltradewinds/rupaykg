import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = getApps().some((item) => item.name === "esg-metrics") ? getApp("esg-metrics") : initializeApp(firebaseConfig, "esg-metrics");
const auth = getAuth(app);
const root = document.getElementById("esg-metrics");
if (!root) throw new Error("ESG metrics mount missing");

type Membership = { organization_id: string; status: string; can_write_esg?: boolean; permissions?: string[] };
type Period = { id: string; organization_id: string; period_start: string; period_end: string; framework: string; status: string };
type Metric = { id: string; reporting_period_id: string; metric_code: string; scope: string; value: string | number; unit: string; status: string };
type Session = { sessionToken: string; memberships: Membership[] };

const api = async (path: string, options: RequestInit = {}, token?: string) => {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
};

let session: Session | null = null;
let periods: Period[] = [];
let metrics: Metric[] = [];
let message = "";
let error = "";

function escapeHtml(value: unknown): string { return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] ?? char)); }
function activeMembership(): Membership | null { return session?.memberships.find((membership) => membership.status === "VERIFIED") ?? null; }
function canWrite(): boolean { return activeMembership()?.can_write_esg === true; }
function render(): void {
  const writable = canWrite();
  root.innerHTML = `<section class="esg-panel" aria-labelledby="esg-title"><div class="esg-panel__header"><div><p class="esg-panel__eyebrow">ESG reporting</p><h2 id="esg-title">Record an ESG metric</h2><p class="esg-panel__intro">Use an existing PostgreSQL reporting period. RupayKG does not create synthetic reporting periods or metric values.</p></div><span class="esg-panel__status">${session ? (writable ? "Write access" : "Read only") : "Sign-in required"}</span></div>${message ? `<p class="esg-panel__message" role="status">${escapeHtml(message)}</p>` : ""}${error ? `<p class="esg-panel__error" role="alert">${escapeHtml(error)}</p>` : ""}${!session ? `<button id="esg-sign-in" type="button">Sign in to ESG workspace</button>` : !activeMembership() ? `<p class="esg-panel__notice">A verified organization membership is required.</p>` : `<form id="esg-form" class="esg-form"><label>Reporting period<select id="esg-period" required ${periods.length ? "" : "disabled"}>${periods.length ? periods.map((period) => `<option value="${escapeHtml(period.id)}">${escapeHtml(period.framework)} · ${escapeHtml(period.period_start)} → ${escapeHtml(period.period_end)} · ${escapeHtml(period.status)}</option>`).join("") : "<option>No reporting periods available</option>"}</select></label><label>Metric code<input id="esg-code" required placeholder="Authoritative metric code" autocomplete="off"></label><label>Scope<select id="esg-scope" required><option value="1">Scope 1</option><option value="2">Scope 2</option><option value="3">Scope 3</option><option value="IMPACT">Impact</option></select></label><div class="esg-form__row"><label>Value<input id="esg-value" required type="number" min="0" step="any" inputmode="decimal"></label><label>Unit<input id="esg-unit" required placeholder="e.g. tCO2e" autocomplete="off"></label></div><div class="esg-form__row"><label>Evidence ID <span class="esg-form__optional">optional</span><input id="esg-evidence" placeholder="Verified evidence UUID" autocomplete="off"></label><label>Verification ID <span class="esg-form__optional">optional</span><input id="esg-verification" placeholder="Approved verification UUID" autocomplete="off"></label></div><button id="esg-submit" type="submit" ${writable && periods.length ? "" : "disabled"}>${writable ? "Record metric" : "ESG write permission required"}</button></form>`}<div class="esg-panel__records"><div class="esg-panel__records-header"><h3>Recorded metrics</h3><span>${metrics.length} loaded</span></div>${metrics.length ? `<div class="esg-record-list">${metrics.map((metric) => `<article class="esg-record"><strong>${escapeHtml(metric.metric_code)}</strong><span>Scope ${escapeHtml(metric.scope)} · ${escapeHtml(metric.value)} ${escapeHtml(metric.unit)}</span><small>${escapeHtml(metric.status)}</small></article>`).join("")}</div>` : `<p class="esg-panel__empty">No ESG metrics are visible for the authorized organizations.</p>`}</div></section>`;
  document.getElementById("esg-sign-in")?.addEventListener("click", () => void signInWithRedirect(auth, new GoogleAuthProvider()));
  document.getElementById("esg-form")?.addEventListener("submit", (event) => { event.preventDefault(); void submitMetric(); });
}

async function loadSession(firebaseUser: import("firebase/auth").User): Promise<void> {
  if (!firebaseUser.emailVerified) throw new Error("Verified email is required before ESG workspace access.");
  const idToken = await firebaseUser.getIdToken(true);
  const exchanged = await api("/api/v1/auth/exchange", { method: "POST", body: JSON.stringify({ idToken }) });
  session = { sessionToken: exchanged.sessionToken, memberships: exchanged.memberships ?? [] };
  const me = await api("/api/v1/auth/me", {}, session.sessionToken);
  session.memberships = me.memberships ?? [];
  await loadWorkspace();
}
async function loadWorkspace(): Promise<void> {
  if (!session) return;
  const workspace = await api("/api/v1/workspaces/esg", {}, session.sessionToken);
  periods = workspace.data?.reportingPeriods ?? [];
  metrics = workspace.data?.metrics ?? [];
  render();
}
async function submitMetric(): Promise<void> {
  if (!session || !canWrite()) return;
  error = ""; message = "";
  const periodId = (document.getElementById("esg-period") as HTMLSelectElement)?.value;
  const metricCode = (document.getElementById("esg-code") as HTMLInputElement)?.value.trim();
  const scope = (document.getElementById("esg-scope") as HTMLSelectElement)?.value;
  const value = Number((document.getElementById("esg-value") as HTMLInputElement)?.value);
  const unit = (document.getElementById("esg-unit") as HTMLInputElement)?.value.trim();
  const evidenceId = (document.getElementById("esg-evidence") as HTMLInputElement)?.value.trim();
  const verificationId = (document.getElementById("esg-verification") as HTMLInputElement)?.value.trim();
  if (!periodId || !metricCode || !scope || !unit || !Number.isFinite(value) || value < 0) { error = "Reporting period, metric code, scope, unit and a non-negative value are required."; render(); return; }
  try {
    const result = await api(`/api/v1/esg/reporting-periods/${encodeURIComponent(periodId)}/metrics`, { method: "POST", body: JSON.stringify({ metricCode, scope, unit, value, ...(evidenceId ? { evidenceId } : {}), ...(verificationId ? { verificationId } : {}) }) }, session.sessionToken);
    message = `Metric ${result.metric?.id ?? "record"} saved authoritatively in PostgreSQL.`;
    await loadWorkspace();
  } catch (caught) { error = caught instanceof Error ? caught.message : "ESG metric recording failed."; render(); }
}

getRedirectResult(auth).catch((caught) => { error = caught instanceof Error ? caught.message : "Firebase sign-in failed."; render(); });
onAuthStateChanged(auth, (user) => { if (!user) { session = null; periods = []; metrics = []; render(); return; } void loadSession(user).catch((caught) => { session = null; error = caught instanceof Error ? caught.message : "ESG workspace unavailable."; render(); }); });
render();
