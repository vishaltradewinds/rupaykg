import { getAuth, onAuthStateChanged, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { getApps, getApp, initializeApp } from "firebase/app";
import "./styles.css";

type Membership = { organization_id: string; status: string; permissions?: string[] };
type Session = { sessionToken: string; memberships: Membership[] };
type Profile = { applicability_status: string; jurisdiction_name?: string };
type Period = { id: string; period_start: string; period_end: string; reporting_basis: string; status: string; external_submission_status: string };
type Workspace = { profiles: Profile[]; periods: Period[]; wasteReports: unknown[]; eprReports: unknown[]; esgReports: unknown[] };

const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const firebaseApp = getApps().some((item) => item.name === "bwg-reporting") ? getApp("bwg-reporting") : initializeApp(firebaseConfig, "bwg-reporting");
const auth = getAuth(firebaseApp);
const root = document.getElementById("bwg-reporting");
if (!root) throw new Error("BWG reporting mount missing");
let session: Session | null = null;
let workspace: Workspace = { profiles: [], periods: [], wasteReports: [], eprReports: [], esgReports: [] };
let statusMessage = "";
let errorMessage = "";

const text = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? "";
const number = (id: string) => Number(text(id));
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] ?? c));
const membership = () => session?.memberships.find((item) => item.status === "VERIFIED") ?? null;
const permitted = (permission: string) => membership()?.permissions?.includes(permission) ?? false;

const request = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}), ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
};

function render(): void {
  if (!session) {
    root.innerHTML = `<section class="compliance-card bwg-card"><div class="compliance-head"><div><p class="eyebrow">BULK WASTE GENERATOR</p><h2>EPR &amp; ESG reporting</h2><p>Authoritative reporting workspace. External submission or acceptance is never inferred.</p></div><span class="compliance-state">SIGN IN REQUIRED</span></div><button id="bwg-sign-in" type="button">Sign in to BWG workspace</button></section>`;
    root.querySelector("#bwg-sign-in")?.addEventListener("click", () => void signInWithRedirect(auth, new GoogleAuthProvider()));
    return;
  }
  const org = membership();
  if (!org) {
    root.innerHTML = `<section class="compliance-card bwg-card"><div class="compliance-head"><div><p class="eyebrow">BULK WASTE GENERATOR</p><h2>EPR &amp; ESG reporting</h2></div><span class="compliance-state">VERIFICATION REQUIRED</span></div><p class="field-help">A verified organization membership is required.</p></section>`;
    return;
  }
  const profile = workspace.profiles[0];
  const periods = workspace.periods.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.period_start)} → ${escapeHtml(p.period_end)} · ${escapeHtml(p.reporting_basis)}</option>`).join("");
  root.innerHTML = `<section class="compliance-card bwg-card" aria-labelledby="bwg-title">
    <div class="compliance-head"><div><p class="eyebrow">BULK WASTE GENERATOR</p><h2 id="bwg-title">EPR &amp; ESG reporting</h2><p>Record backend-authoritative applicability, waste, EPR and ESG records. No external submission status is fabricated.</p></div><span class="compliance-state">AUTHENTICATED</span></div>
    ${statusMessage ? `<div class="resource-flow-state">${escapeHtml(statusMessage)}</div>` : ""}${errorMessage ? `<div class="resource-flow-state" role="alert">${escapeHtml(errorMessage)}</div>` : ""}
    <div class="bwg-grid">
      <form id="bwg-profile-form" class="esg-form"><h3>1. BWG applicability</h3><label>Jurisdiction ID<input id="bwg-jurisdiction" required placeholder="Authorized geography UUID"></label><label>Establishment type<input id="bwg-type" required placeholder="Office, hotel, hospital, campus…"></label><div class="esg-form__row"><label>Floor area (sq.m.)<input id="bwg-area" required type="number" min="0" step="0.01"></label><label>Water (L/day)<input id="bwg-water" required type="number" min="0" step="0.01"></label></div><label>Waste generation (kg/day)<input id="bwg-waste" required type="number" min="0" step="0.01"></label><button type="submit" ${permitted("profile:update") ? "" : "disabled"}>Save authoritative profile</button>${profile ? `<p class="field-help">Current status: <strong>${escapeHtml(profile.applicability_status)}</strong> · ${escapeHtml(profile.jurisdiction_name ?? "authorized jurisdiction")}</p>` : ""}</form>
      <form id="bwg-period-form" class="esg-form"><h3>2. Reporting period</h3><div class="esg-form__row"><label>Start<input id="bwg-start" required type="date"></label><label>End<input id="bwg-end" required type="date"></label></div><label>Reporting basis<select id="bwg-basis"><option value="SWM_2026">SWM Rules 2026</option><option value="EPR">EPR</option><option value="ESG">ESG</option><option value="BRSR_VALUE_CHAIN">BRSR / value chain (where applicable)</option></select></label><button type="submit" ${permitted("waste:record") ? "" : "disabled"}>Create reporting period</button></form>
      <form id="bwg-waste-form" class="esg-form"><h3>3. Waste report</h3><label>Reporting period<select id="bwg-waste-period" required>${periods || `<option value="">Create a period first</option>`}</select></label><label>Waste stream<input id="bwg-stream" required placeholder="Dry / wet / plastic / organic…"></label><div class="esg-form__row"><label>Generated<input id="bwg-generated" required type="number" min="0" step="0.001"></label><label>Segregated<input id="bwg-segregated" type="number" min="0" step="0.001" value="0"></label></div><div class="esg-form__row"><label>Channelised<input id="bwg-channelized" type="number" min="0" step="0.001" value="0"></label><label>Processed<input id="bwg-processed" type="number" min="0" step="0.001" value="0"></label></div><label>Unit<input id="bwg-unit" required value="kg"></label><label>Verified evidence UUID<input id="bwg-waste-evidence"></label><label>Approved verification UUID<input id="bwg-waste-verification"></label><button type="submit" ${permitted("waste:record") && workspace.periods.length ? "" : "disabled"}>Record waste report</button></form>
      <form id="bwg-epr-form" class="esg-form"><h3>4. EPR report</h3><label>Reporting period<select id="bwg-epr-period" required>${periods || `<option value="">Create a period first</option>`}</select></label><label>EPR scheme UUID<input id="bwg-scheme" required placeholder="Authoritative epr_schemes UUID"></label><label>Category code<input id="bwg-category" required placeholder="Authoritative category code"></label><div class="esg-form__row"><label>Obligated quantity<input id="bwg-obligated" required type="number" min="0" step="0.001"></label><label>Fulfilled quantity<input id="bwg-fulfilled" required type="number" min="0" step="0.001"></label></div><label>Verified evidence UUID<input id="bwg-epr-evidence"></label><label>Approved verification UUID<input id="bwg-epr-verification"></label><button type="submit" ${permitted("epr:manage") && workspace.periods.length ? "" : "disabled"}>Record EPR report</button><p class="field-help">Records an internal authoritative report only; it does not submit to CPCB or claim CPCB acceptance.</p></form>
      <form id="bwg-esg-form" class="esg-form"><h3>5. ESG metric</h3><label>Reporting period<select id="bwg-esg-period" required>${periods || `<option value="">Create a period first</option>`}</select></label><label>Metric code<input id="bwg-metric" required placeholder="Authoritative metric code"></label><div class="esg-form__row"><label>Scope<input id="bwg-scope" required placeholder="1 / 2 / 3 / IMPACT"></label><label>Unit<input id="bwg-esg-unit" required placeholder="kg, kWh, tCO2e…"></label></div><label>Value<input id="bwg-value" required type="number" min="0" step="any"></label><label>Verified evidence UUID<input id="bwg-esg-evidence"></label><label>Approved verification UUID<input id="bwg-esg-verification"></label><button type="submit" ${permitted("reports:write") && workspace.periods.length ? "" : "disabled"}>Record ESG metric</button></form>
    </div><div class="compliance-list"><h3>Authoritative records</h3><p class="field-help">Profiles: ${workspace.profiles.length} · periods: ${workspace.periods.length} · waste: ${workspace.wasteReports.length} · EPR: ${workspace.eprReports.length} · ESG: ${workspace.esgReports.length}</p></div></section>`;
  root.querySelector("#bwg-profile-form")?.addEventListener("submit", (event) => { event.preventDefault(); void save("/api/v1/bwg/profile", { organizationId: org.organization_id, jurisdictionId: text("bwg-jurisdiction"), establishmentType: text("bwg-type"), floorAreaSqm: number("bwg-area"), waterConsumptionLpd: number("bwg-water"), wasteGenerationKgDay: number("bwg-waste") }); });
  root.querySelector("#bwg-period-form")?.addEventListener("submit", (event) => { event.preventDefault(); void save("/api/v1/bwg/reporting-periods", { organizationId: org.organization_id, periodStart: text("bwg-start"), periodEnd: text("bwg-end"), reportingBasis: (document.getElementById("bwg-basis") as HTMLSelectElement).value }); });
  root.querySelector("#bwg-waste-form")?.addEventListener("submit", (event) => { event.preventDefault(); const id = (document.getElementById("bwg-waste-period") as HTMLSelectElement).value; void save(`/api/v1/bwg/reporting-periods/${encodeURIComponent(id)}/waste`, { wasteStream: text("bwg-stream"), generatedQuantity: number("bwg-generated"), segregatedQuantity: number("bwg-segregated"), channelizedQuantity: number("bwg-channelized"), processedQuantity: number("bwg-processed"), unit: text("bwg-unit"), evidenceId: text("bwg-waste-evidence") || undefined, verificationId: text("bwg-waste-verification") || undefined }); });
  root.querySelector("#bwg-epr-form")?.addEventListener("submit", (event) => { event.preventDefault(); const id = (document.getElementById("bwg-epr-period") as HTMLSelectElement).value; void save(`/api/v1/bwg/reporting-periods/${encodeURIComponent(id)}/epr`, { schemeId: text("bwg-scheme"), categoryCode: text("bwg-category"), obligatedQuantity: number("bwg-obligated"), fulfilledQuantity: number("bwg-fulfilled"), evidenceId: text("bwg-epr-evidence") || undefined, verificationId: text("bwg-epr-verification") || undefined }); });
  root.querySelector("#bwg-esg-form")?.addEventListener("submit", (event) => { event.preventDefault(); const id = (document.getElementById("bwg-esg-period") as HTMLSelectElement).value; void save(`/api/v1/bwg/reporting-periods/${encodeURIComponent(id)}/esg`, { metricCode: text("bwg-metric"), scope: text("bwg-scope"), unit: text("bwg-esg-unit"), value: number("bwg-value"), evidenceId: text("bwg-esg-evidence") || undefined, verificationId: text("bwg-esg-verification") || undefined }); });
}

async function load(): Promise<void> { if (!session) return; const response = await request("/api/v1/workspaces/bwg"); workspace = response.data ?? workspace; render(); }
async function save(path: string, body: unknown): Promise<void> { statusMessage = ""; errorMessage = ""; try { await request(path, { method: "POST", body: JSON.stringify(body) }); statusMessage = "Saved to PostgreSQL authoritatively."; await load(); } catch (error) { errorMessage = error instanceof Error ? error.message : "Authoritative write failed."; render(); } }

onAuthStateChanged(auth, async (user) => {
  if (!user) { session = null; workspace = { profiles: [], periods: [], wasteReports: [], eprReports: [], esgReports: [] }; render(); return; }
  try { if (!user.emailVerified) throw new Error("Verified email is required before BWG reporting access."); const idToken = await user.getIdToken(true); const exchanged = await request("/api/v1/auth/exchange", { method: "POST", body: JSON.stringify({ idToken }) }); session = { sessionToken: exchanged.sessionToken, memberships: exchanged.memberships ?? [] }; const me = await request("/api/v1/auth/me"); session.memberships = me.memberships ?? []; await load(); }
  catch (error) { session = null; errorMessage = error instanceof Error ? error.message : "BWG workspace unavailable."; render(); }
});
render();
