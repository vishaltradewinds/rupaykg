import { getApps, getApp, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import "./styles.css";

type Verification = { id: string; evidence_id: string; activity_id: string; verifier_identity_id: string; decision: string; scope: string; rationale?: string | null; decided_at: string };
type Evidence = { id: string; activity_id: string; evidence_type: string; status: string; captured_at: string; content_hash?: string | null };
type Activity = { id: string; activity_type: string; status: string; occurred_at?: string | null; created_at: string };
type Provenance = { activity_id: string; verification_id: string; evidence_id: string; guardian_policy_id: string; guardian_execution_id: string; guardian_status: string; hcs_status: string; hcs_topic_id?: string | null; hcs_transaction_id?: string | null; hcs_consensus_timestamp?: string | null; integrity_hash: string; methodology_code?: string | null; created_at: string };
type MrvStatus = { guardian?: { configured?: boolean; integration?: string; syntheticData?: boolean }; hedera?: { configured?: boolean; network?: string; topicId?: string; writeStatus?: string; consensusStatus?: string; syntheticData?: boolean }; registryEligibility?: string; syntheticData?: boolean };
type Workspace = { source?: string; syntheticData?: boolean; data?: { activities?: Activity[]; verifications?: Verification[]; evidence?: Evidence[] } };
type ProvenanceResponse = { source?: string; syntheticData?: boolean; eligibleForRegistry?: boolean; provenance?: Provenance[] };
const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const app = getApps().some((item) => item.name === "mrv-provenance") ? getApp("mrv-provenance") : initializeApp(config, "mrv-provenance");
const auth = getAuth(app);
const rootElement = document.getElementById("mrv-provenance");
if (!rootElement) throw new Error("MRV provenance mount missing");
const root: HTMLElement = rootElement;
const esc = (value: unknown) => String(value ?? "—").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] ?? c));
let token = "";
let message = "";
let workspace: Workspace | null = null;
let status: MrvStatus | null = null;
let provenance: Provenance[] = [];

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Accept: "application/json", ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

const state = (value: unknown) => esc(value ?? "NOT_REPORTED");

function render() {
  const data = workspace?.data;
  const verifications = data?.verifications ?? [];
  const evidence = data?.evidence ?? [];
  const guardianState = status?.guardian?.configured ? "CONFIGURED" : status?.guardian ? "NOT_CONFIGURED" : "NOT_REPORTED";
  const hederaState = status?.hedera?.consensusStatus ?? (status?.hedera ? "NOT_AVAILABLE" : "NOT_REPORTED");
  const eligible = provenance.some((p) => p.guardian_status === "VERIFIED" && p.hcs_status === "CONSENSUS_CONFIRMED");
  root.innerHTML = `<section class="compliance-card bwg-card" aria-labelledby="mrv-provenance-title"><div class="compliance-head"><div><p class="eyebrow">MRV PROVENANCE</p><h2 id="mrv-provenance-title">Verification &amp; ledger evidence</h2><p>Authoritative MRV state only. Local verification is never treated as Guardian/Hedera consensus.</p></div><span class="compliance-state">${token ? "AUTHENTICATED" : "SIGN-IN REQUIRED"}</span></div>${message ? `<p class="resource-flow-state" role="alert">${esc(message)}</p>` : ""}${!token ? `<button id="mrv-sign-in" type="button">Sign in to MRV provenance</button>` : `<div class="bwg-grid"><article class="esg-form"><h3>Local verification</h3><p class="field-help">Approved verification records: <strong>${verifications.filter((v) => v.decision === "APPROVED").length}</strong> · Evidence records: <strong>${evidence.length}</strong></p>${verifications.length ? verifications.slice(0, 20).map((v) => `<div class="compliance-state"><strong>${esc(v.decision)}</strong> · ${esc(v.scope)} · ${esc(v.decided_at)}<br><small>Evidence ${esc(v.evidence_id)} · Verifier ${esc(v.verifier_identity_id)}</small></div>`).join("") : `<p class="field-help">No verification records are visible for the authorized organization.</p>`}</article><article class="esg-form"><h3>Guardian / Hedera integration</h3><p class="field-help">Integration configuration is shown separately from per-activity proof. Registry eligibility requires a persisted Guardian VERIFIED result and HCS CONSENSUS_CONFIRMED result.</p><div class="compliance-state">Guardian integration: ${state(guardianState)}</div><div class="compliance-state">Hedera consensus configuration: ${state(hederaState)}</div><div class="compliance-state">Network: ${state(status?.hedera?.network)}</div><div class="compliance-state">Topic: ${state(status?.hedera?.topicId)}</div><div class="compliance-state">Current verified provenance: ${eligible ? "GUARDIAN_VERIFIED_AND_HCS_CONSENSUS_CONFIRMED" : "NOT_CONFIRMED"}</div></article></div><section class="compliance-list"><h3>Persisted Guardian/HCS provenance</h3>${provenance.length ? provenance.slice(0, 20).map((p) => `<article class="compliance-state"><strong>${esc(p.guardian_status)}</strong> · HCS ${esc(p.hcs_status)}<br><small>Activity ${esc(p.activity_id)} · Evidence ${esc(p.evidence_id)} · Verification ${esc(p.verification_id)}<br>Policy ${esc(p.guardian_policy_id)} · Execution ${esc(p.guardian_execution_id)}<br>Topic ${esc(p.hcs_topic_id)} · Transaction ${esc(p.hcs_transaction_id)} · Consensus ${esc(p.hcs_consensus_timestamp)}<br>Integrity ${esc(p.integrity_hash)}</small></article>`).join("") : `<p class="field-help">No persisted Guardian/HCS provenance is visible for the authorized organization. This is an unverified state, not a successful submission.</p>`}</section></section>`}</section>`;
  document.getElementById("mrv-sign-in")?.addEventListener("click", () => void signInWithRedirect(auth, new GoogleAuthProvider()));
}

async function load() {
  if (!token) return;
  try {
    const [nextWorkspace, nextStatus] = await Promise.all([api<Workspace>("/api/v1/workspaces/mrv"), api<MrvStatus>("/api/v1/mrv/status")]);
    workspace = nextWorkspace;
    status = nextStatus;
    provenance = [];
    const activities = workspace.data?.activities ?? [];
    const responses = await Promise.all(activities.slice(0, 20).map((activity) => api<ProvenanceResponse>(`/api/v1/mrv/provenance/${encodeURIComponent(activity.id)}`).catch(() => null)));
    provenance = responses.flatMap((response) => response?.provenance ?? []);
    message = "";
    render();
  } catch (error) { workspace = null; status = null; provenance = []; message = error instanceof Error ? error.message : "Authoritative MRV workspace unavailable."; render(); }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { token = ""; workspace = null; status = null; provenance = []; render(); return; }
  try {
    if (!user.emailVerified) throw new Error("Verified email is required before MRV provenance access.");
    const idToken = await user.getIdToken(true);
    const exchanged = await api<{ sessionToken: string }>("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
    token = exchanged.sessionToken;
    await load();
  } catch (error) { token = ""; message = error instanceof Error ? error.message : "Unable to authenticate MRV provenance."; render(); }
});
render();
