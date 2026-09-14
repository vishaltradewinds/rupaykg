import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import "./styles.css";

type Membership = { organization_id: string; status: string; permissions?: string[] };
type Session = { sessionToken: string; memberships: Membership[] };
type Evidence = { id: string; activity_id: string; evidence_type: string; status: string; captured_at: string; content_hash?: string | null };
type Workspace = { data?: { evidence?: Evidence[] } };

const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const configured = Object.values(config).every(Boolean);
const app = configured ? (getApps().find((candidate) => candidate.name === "mrv-verification-actions") ?? initializeApp(config, "mrv-verification-actions")) : null;
const auth = app ? getAuth(app) : null;
const root = document.getElementById("mrv-verification-actions");
const organizationKey = "rupaykg.activeOrganizationId";
const activeOrganizationId = () => localStorage.getItem(organizationKey)?.trim() ?? "";
let token = "";
let message = "";
let loading = false;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const organizationId = activeOrganizationId();
  if (token && organizationId) headers.set("x-rupaykg-organization-id", organizationId);
  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}

async function exchange(user: import("firebase/auth").User): Promise<Session> {
  if (!user.emailVerified) throw new Error("Verified email is required before verification actions.");
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken: await user.getIdToken(true) }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Authentication failed (${response.status})`);
  return { sessionToken: String(body.sessionToken ?? ""), memberships: Array.isArray(body.memberships) ? body.memberships : [] };
}

const esc = (value: unknown) => String(value ?? "—").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] ?? c));

function canVerify(memberships: Membership[]): boolean {
  const organizationId = activeOrganizationId();
  const membership = memberships.find((item) => item.status === "VERIFIED" && (!organizationId || item.organization_id === organizationId));
  return Boolean(membership?.permissions?.some((permission) => ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"].includes(permission)));
}

function render(evidence: Evidence[] = [], authorized = false) {
  if (!root) return;
  root.innerHTML = `<section class="compliance-card" aria-labelledby="mrv-verification-actions-title"><div class="compliance-head"><div><p class="eyebrow">MRV CONTROL</p><h2 id="mrv-verification-actions-title">Evidence verification queue</h2><p>Approve evidence only through the authoritative verification API. Guardian/Hedera provenance remains a separate downstream trust gate.</p></div><span class="compliance-state">${authorized ? "VERIFIER ACCESS" : token ? "READ ONLY" : "SIGN IN REQUIRED"}</span></div>${message ? `<div class="resource-flow-state" role="status">${esc(message)}</div>` : ""}${!token ? `<p class="field-help">Sign in with a verified account to review evidence.</p>` : !authorized ? `<p class="field-help">This organization membership does not have the backend verification permission.</p>` : evidence.length ? `<div class="compliance-list">${evidence.slice(0, 30).map((item) => `<article class="compliance-row"><div><strong>${esc(item.evidence_type)}</strong><span>Activity ${esc(item.activity_id)} · captured ${esc(item.captured_at)}</span><small>Status: ${esc(item.status)} · Evidence ${esc(item.id)}</small></div>${item.status === "VERIFIED" ? `<span class="compliance-state">VERIFIED</span>` : `<div class="resource-flow-actions"><input data-scope="${esc(item.id)}" aria-label="Verification scope for ${esc(item.id)}" placeholder="Verification scope" autocomplete="off"><button data-verify="${esc(item.id)}" type="button" ${loading ? "disabled" : ""}>Approve verification</button></div>`}</article>`).join("")}</div>` : `<p class="field-help">No evidence records are currently available for verification.</p>`}</section>`;
  root.querySelectorAll<HTMLButtonElement>("[data-verify]").forEach((button) => button.addEventListener("click", () => void verify(button.dataset.verify ?? "")));
}

async function load() {
  if (!token) return render();
  try {
    const me = await api<{ memberships: Membership[] }>("/api/v1/auth/me");
    const authorized = canVerify(me.memberships ?? []);
    if (!authorized) return render([], false);
    const workspace = await api<Workspace>("/api/v1/workspaces/mrv");
    render(workspace.data?.evidence ?? [], true);
  } catch (error) {
    message = error instanceof Error ? error.message : "Authoritative MRV verification queue is unavailable.";
    render([], false);
  }
}

async function verify(evidenceId: string) {
  const input = root?.querySelector<HTMLInputElement>(`[data-scope="${CSS.escape(evidenceId)}"]`);
  const scope = input?.value.trim() ?? "";
  if (!scope) { message = "Verification scope is required before approval."; return void load(); }
  loading = true; message = ""; render([], true);
  try {
    await api(`/api/v1/evidence/${encodeURIComponent(evidenceId)}/verification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVED", scope }) });
    message = "Evidence verification recorded by the authoritative backend.";
  } catch (error) {
    message = error instanceof Error ? error.message : "Evidence verification failed.";
  } finally { loading = false; await load(); }
}

if (auth && root) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { token = ""; message = ""; return render(); }
    try { const session = await exchange(user); token = session.sessionToken; const verified = session.memberships.filter((m) => m.status === "VERIFIED"); if (!activeOrganizationId() && verified[0]?.organization_id) localStorage.setItem(organizationKey, verified[0].organization_id); await load(); }
    catch (error) { token = ""; message = error instanceof Error ? error.message : "Unable to authenticate MRV verification controls."; render(); }
  });
  window.addEventListener("storage", (event) => { if (event.key === organizationKey) void load(); });
} else if (root) render();
