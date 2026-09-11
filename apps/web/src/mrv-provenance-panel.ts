import { getApps, getApp, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import "./styles.css";

type Verification = { id: string; evidence_id: string; activity_id: string; verifier_identity_id: string; decision: string; scope: string; rationale?: string | null; decided_at: string };
type Evidence = { id: string; activity_id: string; evidence_type: string; status: string; captured_at: string; content_hash?: string | null };
type Workspace = { source?: string; syntheticData?: boolean; data?: { verifications?: Verification[]; evidence?: Evidence[]; provenance?: unknown; guardian?: unknown; hedera?: unknown } };
const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const app = getApps().some((item) => item.name === "mrv-provenance") ? getApp("mrv-provenance") : initializeApp(config, "mrv-provenance");
const auth = getAuth(app);
const root = document.getElementById("mrv-provenance");
if (!root) throw new Error("MRV provenance mount missing");
const esc = (value: unknown) => String(value ?? "—").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] ?? c));
let token = "";
let message = "";
let workspace: Workspace | null = null;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Accept: "application/json", ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

function render() {
  const data = workspace?.data;
  const verifications = data?.verifications ?? [];
  const evidence = data?.evidence ?? [];
  const guardian = data?.guardian ?? data?.provenance ?? null;
  const hedera = data?.hedera ?? null;
  root.innerHTML = `<section class="compliance-card bwg-card" aria-labelledby="mrv-provenance-title"><div class="compliance-head"><div><p class="eyebrow">MRV PROVENANCE</p><h2 id="mrv-provenance-title">Verification &amp; ledger evidence</h2><p>Authoritative MRV state only. Local verification is not treated as Hedera/Guardian consensus.</p></div><span class="compliance-state">${token ? "AUTHENTICATED" : "SIGN-IN REQUIRED"}</span></div>${message ? `<p class="resource-flow-state" role="alert">${esc(message)}</p>` : ""}${!token ? `<button id="mrv-sign-in" type="button">Sign in to MRV provenance</button>` : `<div class="bwg-grid"><article class="esg-form"><h3>Local verification</h3><p class="field-help">Approved verification records: <strong>${verifications.filter((v) => v.decision === "APPROVED").length}</strong> · Evidence records: <strong>${evidence.length}</strong></p>${verifications.length ? verifications.slice(0, 20).map((v) => `<div class="compliance-state"><strong>${esc(v.decision)}</strong> · ${esc(v.scope)} · ${esc(v.decided_at)}<br><small>Evidence ${esc(v.evidence_id)} · Verifier ${esc(v.verifier_identity_id)}</small></div>`).join("") : `<p class="field-help">No verification records are visible for the authorized organization.</p>`}</article><article class="esg-form"><h3>Guardian / Hedera provenance</h3><p class="field-help">The UI never infers blockchain confirmation from a local verification decision.</p><div class="compliance-state">Guardian: ${esc(guardian ?? "NOT_REPORTED_BY_MRV_API")}</div><div class="compliance-state">Hedera HCS: ${esc(hedera ?? "NOT_REPORTED_BY_MRV_API")}</div><p class="field-help">A consensus-confirmed state requires authoritative Guardian/HCS transaction and consensus evidence. Until the API returns that state, it remains unverified.</p></article></div>`}</section>`;
  document.getElementById("mrv-sign-in")?.addEventListener("click", () => void signInWithRedirect(auth, new GoogleAuthProvider()));
}

async function load() {
  if (!token) return;
  try { workspace = await api<Workspace>("/api/v1/workspaces/mrv"); message = ""; render(); }
  catch (error) { workspace = null; message = error instanceof Error ? error.message : "Authoritative MRV workspace unavailable."; render(); }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { token = ""; workspace = null; render(); return; }
  try {
    if (!user.emailVerified) throw new Error("Verified email is required before MRV provenance access.");
    const idToken = await user.getIdToken(true);
    const exchanged = await api<{ sessionToken: string }>("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
    token = exchanged.sessionToken;
    await load();
  } catch (error) { token = ""; message = error instanceof Error ? error.message : "Unable to authenticate MRV provenance."; render(); }
});
render();
