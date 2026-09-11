import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import "./styles.css";

type Membership = { organization_id: string; organization_name: string; status: string };
type Session = { sessionToken: string; memberships: Membership[] };
type Credential = { id: string; activity_id: string; issuer_name: string; trust_root_id: string; status: string; credential_uri: string | null; issued_at: string | null };
type RegistryEvent = { id: string; credential_id: string; event_type: string; from_owner_name: string | null; to_owner_name: string | null; external_reference: string | null; created_at: string };
type Settlement = { id: string; credential_id: string | null; payer_name: string | null; payee_name: string | null; amount: string | number; currency: string; status: string; external_reference: string | null; created_at: string; settled_at: string | null };

type Workspace = { data: { credentials?: Credential[]; events?: RegistryEvent[] } };
type SettlementWorkspace = { data: { settlements?: Settlement[] } };

const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const configured = Object.values(config).every(Boolean);
const auth = configured ? getAuth(getApps().some(app => app.name === "registry-settlement") ? getApps().find(app => app.name === "registry-settlement")! : initializeApp(config, "registry-settlement")) : null;
const root = document.getElementById("registry-settlement");
const organizationKey = "rupaykg.activeOrganizationId";

function text(value: unknown): string { return value === null || value === undefined || value === "" ? "—" : String(value); }
function escape(value: unknown): string { return text(value).replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] ?? c)); }
function date(value: string | null): string { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString(); }

async function api<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}
async function exchange(user: User): Promise<Session> {
  if (!user.emailVerified) throw new Error("Verified email is required before registry or settlement access.");
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Authentication failed (${response.status})`);
  const sessionToken = String(body.sessionToken ?? "");
  if (!sessionToken) throw new Error("Authoritative session token was not returned.");
  return { sessionToken, memberships: body.memberships ?? [] };
}

function render(state: { status: string; message: string; credentials: Credential[]; events: RegistryEvent[]; settlements: Settlement[] }): void {
  if (!root) return;
  const credentialRows = state.credentials.length ? state.credentials.map(c => `<article class="compliance-row"><div><strong>${escape(c.status)}</strong><span>${escape(c.issuer_name)} · activity ${escape(c.activity_id)}</span><small>Credential: ${escape(c.id)} · trust root: ${escape(c.trust_root_id)} · issued: ${escape(date(c.issued_at))}</small></div><span class="field-help">URI: ${escape(c.credential_uri)}</span></article>`).join("") : `<div class="empty">No authoritative credentials are visible for the active organization.</div>`;
  const eventRows = state.events.length ? state.events.map(e => `<article class="compliance-row"><div><strong>${escape(e.event_type)}</strong><span>${escape(e.from_owner_name)} → ${escape(e.to_owner_name)}</span><small>${escape(e.id)} · ${escape(date(e.created_at))}</small></div><span class="field-help">External reference: ${escape(e.external_reference)}</span></article>`).join("") : `<div class="empty">No registry events are visible.</div>`;
  const settlementRows = state.settlements.length ? state.settlements.map(s => `<article class="compliance-row"><div><strong>${escape(s.status)}</strong><span>${escape(s.payer_name)} → ${escape(s.payee_name)} · ${escape(s.amount)} ${escape(s.currency)}</span><small>${escape(s.id)} · created ${escape(date(s.created_at))} · settled ${escape(date(s.settled_at))}</small></div><span class="field-help">External reference: ${escape(s.external_reference)}</span></article>`).join("") : `<div class="empty">No authoritative settlements are visible.</div>`;
  root.innerHTML = `<section class="compliance-card" aria-labelledby="registry-settlement-title"><div class="compliance-head"><div><p class="eyebrow">AUTHORITATIVE VALUE OPERATIONS</p><h2 id="registry-settlement-title">Registry & settlement control room</h2><p>Read-only projection of PostgreSQL registry and settlement state. External confirmation is never inferred from an internal status.</p></div><span class="compliance-state">${escape(state.status)}</span></div>${state.message ? `<div class="resource-flow-state" role="status">${escape(state.message)}</div>` : ""}<div class="compliance-list"><h3>Credentials</h3>${credentialRows}<h3>Registry events</h3>${eventRows}<h3>Settlements & reconciliation</h3>${settlementRows}</div></section>`;
}

async function load(user: User): Promise<void> {
  if (!root || !auth) return;
  try {
    const session = await exchange(user);
    const verified = session.memberships.filter(m => m.status === "VERIFIED");
    if (!verified.length) throw new Error("A verified organization membership is required.");
    const selected = localStorage.getItem(organizationKey);
    if (selected && !verified.some(m => m.organization_id === selected)) localStorage.removeItem(organizationKey);
    const [registry, settlement] = await Promise.all([api<Workspace>("/api/v1/workspaces/registry", session.sessionToken), api<SettlementWorkspace>("/api/v1/workspaces/settlement", session.sessionToken)]);
    render({ status: "AUTHORITATIVE", message: "Registry and settlement state loaded from PostgreSQL.", credentials: registry.data?.credentials ?? [], events: registry.data?.events ?? [], settlements: settlement.data?.settlements ?? [] });
  } catch (error) {
    render({ status: "UNAVAILABLE", message: error instanceof Error ? error.message : "Authoritative registry and settlement data is unavailable.", credentials: [], events: [], settlements: [] });
  }
}

if (root) {
  if (!auth) render({ status: "CONFIGURATION REQUIRED", message: "Firebase configuration is required for authenticated registry and settlement access.", credentials: [], events: [], settlements: [] });
  else onAuthStateChanged(auth, user => { if (user) void load(user); else render({ status: "SIGN IN REQUIRED", message: "Sign in to load authorized registry and settlement state.", credentials: [], events: [], settlements: [] }); });
  window.addEventListener("storage", event => { if (event.key === organizationKey && auth.currentUser) void load(auth.currentUser); });
}
