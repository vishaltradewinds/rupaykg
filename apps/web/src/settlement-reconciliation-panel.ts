import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import "./styles.css";

type Membership = { organization_id: string; organization_name: string; status: string; permissions?: string[] };
type Credential = { id: string; activity_id: string; issuer_name: string; status: string; quantity?: string | number; unit?: string };
type Settlement = { id: string; credential_id: string | null; payer_id?: string | null; payee_id?: string | null; payer_name: string | null; payee_name: string | null; amount: string | number; currency: string; status: string; external_reference: string | null; authorization_reference?: string | null; confirmation_reference?: string | null; reconciliation_reference?: string | null; external_confirmed_at?: string | null; created_at: string; settled_at: string | null };
type Session = { sessionToken: string; memberships: Membership[] };
type Workspace = { data?: { credentials?: Credential[]; settlements?: Settlement[] } };

const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const configured = Object.values(config).every(Boolean);
const app = configured ? (getApps().find(candidate => candidate.name === "settlement-reconciliation") ?? initializeApp(config, "settlement-reconciliation")) : null;
const auth = app ? getAuth(app) : null;
const root = document.getElementById("settlement-reconciliation-control");
const organizationKey = "rupaykg.activeOrganizationId";
const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const escape = (value: unknown) => text(value).replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] ?? c));
const activeOrganizationId = () => localStorage.getItem(organizationKey)?.trim() ?? "";
const organizationHeaders = (): Record<string, string> => { const id = activeOrganizationId(); return id ? { "x-rupaykg-organization-id": id } : {}; };

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); headers.set("Accept", "application/json"); headers.set("Authorization", `Bearer ${token}`); Object.entries(organizationHeaders()).forEach(([k, v]) => headers.set(k, v));
  const response = await fetch(path, { ...init, headers }); const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`); return body as T;
}

async function exchange(user: User): Promise<Session> {
  if (!user.emailVerified) throw new Error("Verified email is required before settlement control access.");
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken: await user.getIdToken(true) }) });
  const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error ?? `Authentication failed (${response.status})`);
  return { sessionToken: String(body.sessionToken ?? ""), memberships: Array.isArray(body.memberships) ? body.memberships : [] };
}

function stateLabel(value: string): string { const normalized = value.toUpperCase(); return ["CREATED", "AUTHORIZED", "EXECUTING", "RECONCILING", "SETTLED", "CANCELLED", "FAILED"].includes(normalized) ? normalized : `UNCONFIRMED · ${normalized}`; }
function field(label: string, value: string, attrs = ""): string { return `<label class="resource-flow-field"><span>${escape(label)}</span><input value="${escape(value)}" ${attrs}></label>`; }

function render(state: { status: string; message: string; session: Session | null; credentials: Credential[]; settlements: Settlement[] }): void {
  if (!root) return;
  if (!state.session) { root.innerHTML = `<section class="compliance-card"><div class="compliance-head"><div><p class="eyebrow">SETTLEMENT CONTROL</p><h2>Settlement & reconciliation</h2><p>Sign in with a verified account to access organization-scoped settlement controls.</p></div><span class="compliance-state">${escape(state.status)}</span></div>${state.message ? `<div class="resource-flow-state" role="status">${escape(state.message)}</div>` : ""}</section>`; return; }
  const verified = state.session.memberships.filter(m => m.status === "VERIFIED");
  const credentialOptions = state.credentials.filter(c => ["ACTIVE", "TRANSFERRED"].includes(c.status)).map(c => `<option value="${escape(c.id)}">${escape(c.id)} · ${escape(c.quantity ?? "")} ${escape(c.unit ?? "")} · ${escape(c.status)}</option>`).join("");
  const orgOptions = verified.map(m => `<option value="${escape(m.organization_id)}">${escape(m.organization_name)} · ${escape(m.organization_id)}</option>`).join("");
  const rows = state.settlements.length ? state.settlements.map(s => {
    const authorize = s.status === "CREATED" ? `<div class="resource-flow-actions"><input data-auth-ref="${escape(s.id)}" aria-label="Authorization reference" placeholder="Authorization reference"><button data-action="authorize" data-settlement="${escape(s.id)}">Authorize</button></div>` : "";
    const settle = ["AUTHORIZED", "EXECUTING"].includes(s.status) ? `<div class="resource-flow-actions"><input data-external-ref="${escape(s.id)}" aria-label="External settlement reference" placeholder="External settlement reference" value="${escape(s.external_reference)}"><button data-action="settle" data-settlement="${escape(s.id)}">Record payment / reconcile</button></div>` : "";
    const confirm = s.status === "RECONCILING" ? `<div class="resource-flow-actions"><input data-confirm-ref="${escape(s.id)}" aria-label="External authority confirmation reference" placeholder="Bank / external confirmation reference"><input data-recon-ref="${escape(s.id)}" aria-label="Reconciliation reference" placeholder="Reconciliation reference"><button data-action="confirm" data-settlement="${escape(s.id)}">Confirm & settle</button></div>` : "";
    const evidence = s.status === "SETTLED" ? `<span class="field-help">External confirmation: ${escape(s.external_confirmed_at)} · reconciliation: ${escape(s.reconciliation_reference)} · confirmation: ${escape(s.confirmation_reference)}</span>` : "";
    return `<article class="compliance-row"><div><strong>${escape(stateLabel(s.status))}</strong><span>${escape(s.payer_name)} → ${escape(s.payee_name)} · ${escape(s.amount)} ${escape(s.currency)}</span><small>${escape(s.id)} · credential ${escape(s.credential_id)} · created ${escape(s.created_at)} · settled ${escape(s.settled_at)}</small></div><span class="field-help">External reference: ${escape(s.external_reference)}</span>${authorize}${settle}${confirm}${evidence}</article>`;
  }).join("") : `<div class="empty">No authoritative settlements are visible for the active organization.</div>`;
  root.innerHTML = `<section class="compliance-card" aria-labelledby="settlement-reconciliation-title"><div class="compliance-head"><div><p class="eyebrow">AUTHORITATIVE VALUE OPERATIONS</p><h2 id="settlement-reconciliation-title">Settlement & reconciliation</h2><p>Each action calls the guarded API. Authorization, payment evidence, external confirmation and reconciliation references are server-enforced and become immutable once confirmed.</p></div><span class="compliance-state">${escape(state.status)}</span></div>${state.message ? `<div class="resource-flow-state" role="status">${escape(state.message)}</div>` : ""}<div class="compliance-card"><h3>Create settlement</h3><div class="resource-flow-grid"><label class="resource-flow-field"><span>Credential</span><select id="settlement-credential" aria-label="Settlement credential"><option value="">Select an active credential</option>${credentialOptions}</select></label><label class="resource-flow-field"><span>Payer</span><select id="settlement-payer" aria-label="Settlement payer"><option value="">Select payer</option>${orgOptions}</select></label><label class="resource-flow-field"><span>Payee</span><select id="settlement-payee" aria-label="Settlement payee"><option value="">Select payee</option>${orgOptions}</select></label>${field("Amount", "", 'id="settlement-amount" inputmode="decimal" placeholder="Positive amount"')}${field("Currency", "INR", 'id="settlement-currency" maxlength="3" autocomplete="off"')}${field("External reference (optional)", "", 'id="settlement-external" autocomplete="off"')}</div><button id="create-settlement">Create settlement</button></div><div class="compliance-list"><h3>Lifecycle controls</h3>${rows}</div></section>`;
  root.querySelector<HTMLButtonElement>("#create-settlement")?.addEventListener("click", () => void performCreate(state));
  root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(button => button.addEventListener("click", () => void performAction(button.dataset.action!, button.dataset.settlement!, state)));
}

async function load(user: User): Promise<void> {
  if (!root) return;
  try { const session = await exchange(user); const verified = session.memberships.filter(m => m.status === "VERIFIED"); if (!verified.length) throw new Error("A verified organization membership is required."); const [registry, settlement] = await Promise.all([api<Workspace>("/api/v1/workspaces/registry", session.sessionToken), api<Workspace>("/api/v1/workspaces/settlement", session.sessionToken)]); render({ status: "AUTHORITATIVE", message: "Settlement state loaded from PostgreSQL.", session, credentials: registry.data?.credentials ?? [], settlements: settlement.data?.settlements ?? [] }); } catch (error) { render({ status: "UNAVAILABLE", message: error instanceof Error ? error.message : "Authoritative settlement data is unavailable.", session: null, credentials: [], settlements: [] }); }
}

async function reload(state: { status: string; message: string; session: Session | null; credentials: Credential[]; settlements: Settlement[] }): Promise<void> { const user = auth?.currentUser; if (!user) return; const session = await exchange(user); const [registry, settlement] = await Promise.all([api<Workspace>("/api/v1/workspaces/registry", session.sessionToken), api<Workspace>("/api/v1/workspaces/settlement", session.sessionToken)]); state.session = session; state.credentials = registry.data?.credentials ?? []; state.settlements = settlement.data?.settlements ?? []; state.status = "AUTHORITATIVE"; render(state); }

async function performCreate(state: { status: string; message: string; session: Session | null; credentials: Credential[]; settlements: Settlement[] }): Promise<void> {
  const user = auth?.currentUser; if (!user || !state.session) return; const credentialId = root?.querySelector<HTMLSelectElement>("#settlement-credential")?.value ?? ""; const payerId = root?.querySelector<HTMLSelectElement>("#settlement-payer")?.value ?? ""; const payeeId = root?.querySelector<HTMLSelectElement>("#settlement-payee")?.value ?? ""; const amount = root?.querySelector<HTMLInputElement>("#settlement-amount")?.value.trim() ?? ""; const currency = (root?.querySelector<HTMLInputElement>("#settlement-currency")?.value.trim() ?? "").toUpperCase(); const externalReference = root?.querySelector<HTMLInputElement>("#settlement-external")?.value.trim() ?? "";
  if (!credentialId || !payerId || !payeeId || !amount || !currency) { state.message = "Credential, payer, payee, positive amount and currency are required."; render(state); return; }
  try { const result = await api<{ settlement: Settlement }>("/api/v1/settlements", state.session.sessionToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credentialId, payerId, payeeId, amount: Number(amount), currency, externalReference: externalReference || undefined }) }); state.message = `Settlement ${result.settlement.id} created in CREATED state.`; await reload(state); } catch (error) { state.message = error instanceof Error ? error.message : "Settlement creation failed."; render(state); }
}

async function performAction(action: string, settlementId: string, state: { status: string; message: string; session: Session | null; credentials: Credential[]; settlements: Settlement[] }): Promise<void> {
  if (!state.session) return; const row = state.settlements.find(s => s.id === settlementId); if (!row) return; let path = ""; let body: Record<string, string> = {};
  if (action === "authorize") { const value = root?.querySelector<HTMLInputElement>(`[data-auth-ref="${CSS.escape(settlementId)}"]`)?.value.trim() ?? ""; if (!value) { state.message = "Authorization reference is required."; render(state); return; } path = `/api/v1/settlements/${encodeURIComponent(settlementId)}/authorize`; body = { authorizationReference: value }; }
  else if (action === "settle") { const value = root?.querySelector<HTMLInputElement>(`[data-external-ref="${CSS.escape(settlementId)}"]`)?.value.trim() ?? ""; if (!value) { state.message = "External settlement reference is required."; render(state); return; } path = `/api/v1/settlements/${encodeURIComponent(settlementId)}/settle`; body = { externalReference: value }; }
  else if (action === "confirm") { const confirmationReference = root?.querySelector<HTMLInputElement>(`[data-confirm-ref="${CSS.escape(settlementId)}"]`)?.value.trim() ?? ""; const reconciliationReference = root?.querySelector<HTMLInputElement>(`[data-recon-ref="${CSS.escape(settlementId)}"]`)?.value.trim() ?? ""; if (!confirmationReference || !reconciliationReference) { state.message = "External authority confirmation and reconciliation references are both required."; render(state); return; } path = `/api/v1/settlements/${encodeURIComponent(settlementId)}/confirm`; body = { confirmationReference, reconciliationReference }; }
  else return;
  try { await api(path, state.session.sessionToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); state.message = action === "authorize" ? "Settlement authorization recorded." : action === "settle" ? "External payment reference recorded; settlement is now reconciling." : "External confirmation and reconciliation recorded; settlement is SETTLED."; await reload(state); } catch (error) { state.message = error instanceof Error ? error.message : "Settlement lifecycle action failed."; render(state); }
}

if (root) {
  if (!auth) render({ status: "CONFIGURATION REQUIRED", message: "Firebase configuration is required for authenticated settlement control.", session: null, credentials: [], settlements: [] });
  else onAuthStateChanged(auth, user => { if (user) void load(user); else render({ status: "SIGN IN REQUIRED", message: "Sign in to load authorized settlement controls.", session: null, credentials: [], settlements: [] }); });
  window.addEventListener("storage", event => { if (event.key === organizationKey && auth?.currentUser) void load(auth.currentUser); });
}