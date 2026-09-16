import React from "react";
import { createRoot } from "react-dom/client";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import "./carbon-command-center.css";

type Membership = { organization_id: string; organization_name: string; status: string; role_name: string; permissions: string[] };
type Me = { identity: { id: string } | null; memberships: Membership[] };
type Calculation = {
  id: string; activity_id: string; methodology_code?: string; methodology_version?: string; governance_status?: string;
  inputs?: unknown; result?: unknown; unit?: string; status?: string; calculated_at?: string;
  dataset_hash?: string; formula_hash?: string; calculation_hash?: string; provenance_version?: string; calculation_trace?: unknown;
};
type MrvWorkspace = {
  activities?: Array<{ id: string; status?: string; activity_type?: string; occurred_at?: string }>;
  measurements?: Array<{ id: string; activity_id: string; value?: unknown; unit?: string; quality_status?: string; measured_at?: string }>;
  evidence?: Array<{ id: string; activity_id: string; measurement_id?: string; evidence_type?: string; status?: string; captured_at?: string; content_hash?: string }>;
  verifications?: Array<{ id: string; activity_id: string; evidence_id?: string; decision?: string; scope?: string; decided_at?: string }>;
};
type Workspace = { source?: string; syntheticData?: boolean; calculations?: Calculation[] };

const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const firebaseApp = Object.values(firebaseConfig).every(Boolean) ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const orgKey = "rupaykg.activeOrganizationId";

async function exchange(user: User) {
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken: await user.getIdToken(true) }) });
  const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error ?? `Authentication failed (${response.status})`); return String(body.sessionToken);
}
function statusLabel(value: unknown) { const raw = String(value ?? "").trim().toUpperCase(); if (["VERIFIED","APPROVED","ACTIVE","ELIGIBLE","CONFIRMED","ISSUED"].includes(raw)) return "VERIFIED"; if (["PENDING","UNDER_REVIEW","CALCULATED"].includes(raw)) return "PENDING"; if (["REJECTED","FAILED","BLOCKED"].includes(raw)) return "REJECTED"; return raw || "UNAVAILABLE"; }
function shortHash(value?: string) { return value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "—"; }
function display(value: unknown) { if (value === null || value === undefined || value === "") return "—"; if (typeof value === "object") return JSON.stringify(value); return String(value); }
function Stage({ name, state, detail, onClick }: { name: string; state: string; detail: string; onClick?: () => void }) { return <button type="button" className={`ccc-stage state-${state.toLowerCase()}`} onClick={onClick} disabled={!onClick}><span>{state}</span><strong>{name}</strong><small>{detail}</small></button>; }

function Panel() {
  const [user, setUser] = React.useState<User | null>(null); const [token, setToken] = React.useState(""); const [me, setMe] = React.useState<Me | null>(null);
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null); const [mrv, setMrv] = React.useState<MrvWorkspace | null>(null); const [error, setError] = React.useState(""); const [loading, setLoading] = React.useState(true);
  const membership = React.useMemo(() => { const verified = me?.memberships.filter(m => m.status === "VERIFIED") ?? []; const stored = localStorage.getItem(orgKey) ?? ""; return verified.find(m => m.organization_id === stored) ?? verified[0] ?? null; }, [me]);
  const load = React.useCallback(async (sessionToken: string) => {
    setLoading(true); setError("");
    try {
      const headers = new Headers({ Authorization: `Bearer ${sessionToken}`, Accept: "application/json" }); const activeOrg = localStorage.getItem(orgKey); if (activeOrg) headers.set("X-RupayKG-Organization-Id", activeOrg);
      const [identityResponse, carbonResponse, mrvResponse] = await Promise.all([fetch("/api/v1/auth/me", { headers }), fetch("/api/v1/workspaces/carbon", { headers }), fetch("/api/v1/workspaces/mrv", { headers })]);
      const identity = await identityResponse.json().catch(() => ({})) as Me; const carbon = await carbonResponse.json().catch(() => ({})) as Workspace; const mrvBody = await mrvResponse.json().catch(() => ({})) as MrvWorkspace & { error?: string };
      if (!identityResponse.ok) throw new Error(identity?.identity ? "Unable to load organization context." : (carbon as any)?.error ?? "Authenticated organization context unavailable.");
      if (!carbonResponse.ok) throw new Error((carbon as any)?.error ?? "Carbon workspace unavailable.");
      if (!mrvResponse.ok) throw new Error(mrvBody?.error ?? "MRV workspace unavailable.");
      setMe(identity); setWorkspace(carbon); setMrv(mrvBody);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Carbon command center unavailable."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { if (!firebaseAuth) { setLoading(false); return; } return onAuthStateChanged(firebaseAuth, async currentUser => { setUser(currentUser); if (!currentUser || !currentUser.emailVerified) { setToken(""); setMe(null); setWorkspace(null); setMrv(null); setLoading(false); return; } try { const sessionToken = await exchange(currentUser); setToken(sessionToken); await load(sessionToken); } catch (cause) { setError(cause instanceof Error ? cause.message : "Authenticated session unavailable."); setLoading(false); } }); }, [load]);
  React.useEffect(() => { const refresh = () => { if (token) void load(token); }; window.addEventListener("rupaykg:authoritative-mutation", refresh); window.addEventListener("storage", refresh); const timer = window.setInterval(refresh, 30000); return () => { window.removeEventListener("rupaykg:authoritative-mutation", refresh); window.removeEventListener("storage", refresh); window.clearInterval(timer); }; }, [token, load]);
  if (!user || !token || loading) return null; if (error) return <section className="ccc-shell"><div className="ccc-error">{error}</div></section>; if (!membership) return null;
  const calculations = workspace?.calculations ?? []; const latest = calculations[0]; const calculationState = latest ? statusLabel(latest.status) : "UNAVAILABLE"; const methodologyState = latest?.methodology_code ? statusLabel(latest.governance_status) : "UNAVAILABLE"; const valueState = latest ? statusLabel(latest.status) : "UNAVAILABLE";
  const verifiedCount = calculations.filter(c => statusLabel(c.status) === "VERIFIED").length; const pendingCount = calculations.filter(c => statusLabel(c.status) === "PENDING").length;
  const latestEvidence = latest ? (mrv?.evidence ?? []).filter(e => e.activity_id === latest.activity_id).sort((a,b) => String(b.captured_at ?? "").localeCompare(String(a.captured_at ?? "")))[0] : null;
  const latestVerification = latest ? (mrv?.verifications ?? []).filter(v => v.activity_id === latest.activity_id).sort((a,b) => String(b.decided_at ?? "").localeCompare(String(a.decided_at ?? "")))[0] : null;
  const latestMeasurement = latest ? (mrv?.measurements ?? []).filter(m => m.activity_id === latest.activity_id).sort((a,b) => String(b.measured_at ?? "").localeCompare(String(a.measured_at ?? "")))[0] : null;
  const activity = latest ? (mrv?.activities ?? []).find(a => a.id === latest.activity_id) : null;
  const jump = (label: string) => { const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase().includes(label.toLowerCase())); button?.click(); };
  const evidenceState = latestEvidence ? statusLabel(latestEvidence.status) : "UNAVAILABLE"; const verificationState = latestVerification ? statusLabel(latestVerification.decision) : "UNAVAILABLE";
  return <section className="ccc-shell" aria-label="Carbon and CCTS Command Center">
    <div className="ccc-heading"><div><p className="eyebrow">CARBON / CCTS COMMAND CENTER</p><h2>Verified value pathway</h2><p>One operational view of the evidence-backed carbon pathway for the active organization.</p></div><div className="ccc-context"><strong>{membership.organization_name}</strong><span>{membership.role_name}</span><small>Source: PostgreSQL · Synthetic data: false</small></div></div>
    <div className="ccc-stages">
      <Stage name="Activity" state={activity?.id ? (activity.status === "COMPLETED" ? "VERIFIED" : "PENDING") : "UNAVAILABLE"} detail={activity?.id ? `${activity.id} · ${activity.status ?? "status unavailable"}` : "No carbon calculation linked yet"} onClick={() => jump("operations")} />
      <Stage name="Evidence" state={evidenceState} detail={latestEvidence ? `${latestEvidence.evidence_type ?? "Evidence"} · ${latestEvidence.id}` : "No evidence record linked to this activity"} onClick={() => jump("mrv & evidence")} />
      <Stage name="Verification" state={verificationState} detail={latestVerification ? `${latestVerification.decision ?? "Decision"} · ${latestVerification.id}` : "No verification record linked to this activity"} onClick={() => jump("mrv & evidence")} />
      <Stage name="Methodology" state={methodologyState} detail={latest ? `${latest.methodology_code ?? "Methodology"} · v${latest.methodology_version ?? "—"}` : "Registered methodology not yet observed"} />
      <Stage name="Calculation" state={calculationState} detail={latest ? `${display(latest.result)} ${latest.unit ?? ""}` : "No authoritative calculation"} />
      <Stage name="Credential" state="UNAVAILABLE" detail="Registry authority is separate; calculation does not imply issuance" onClick={() => jump("registry")} />
      <Stage name="Settlement" state="UNAVAILABLE" detail="Settlement authority is separate; no transaction state inferred" onClick={() => jump("settlement")} />
    </div>
    <div className="ccc-metrics"><article><span>CALCULATIONS</span><strong>{calculations.length}</strong><small>Authoritative carbon calculation records</small></article><article><span>VERIFIED</span><strong>{verifiedCount}</strong><small>Calculation records with a recognized verified status</small></article><article><span>PENDING</span><strong>{pendingCount}</strong><small>Calculation records requiring status completion</small></article><article><span>VALUE STATE</span><strong>{valueState}</strong><small>Never inferred beyond backend state</small></article></div>
    {latest ? <><div className="ccc-detail-grid"><article className="ccc-card"><p className="eyebrow">LATEST AUTHORITATIVE CALCULATION</p><h3>{display(latest.result)} {latest.unit ?? ""}</h3><div className="ccc-fields"><span><b>Activity</b>{display(latest.activity_id)}</span><span><b>Measurement</b>{latestMeasurement ? `${latestMeasurement.id} · ${display(latestMeasurement.value)} ${latestMeasurement.unit ?? ""}` : "—"}</span><span><b>Methodology</b>{display(latest.methodology_code)} · {display(latest.methodology_version)}</span><span><b>Calculated</b>{display(latest.calculated_at)}</span><span><b>Status</b>{statusLabel(latest.status)}</span></div></article><article className="ccc-card"><p className="eyebrow">MRV HANDOFF</p><div className="ccc-fields"><span><b>Evidence ID</b>{latestEvidence?.id ?? "—"}</span><span><b>Verification ID</b>{latestVerification?.id ?? "—"}</span><span><b>Evidence status</b>{evidenceState}</span><span><b>Verification</b>{verificationState}</span><span><b>Verification scope</b>{latestVerification?.scope ?? "—"}</span></div><small className="ccc-note">MRV state is read from the authoritative MRV workspace. Guardian execution and Hedera consensus remain separate provenance authority and are not inferred here.</small></article></div><div className="ccc-detail-grid"><article className="ccc-card"><p className="eyebrow">PROVENANCE</p><div className="ccc-fields"><span><b>Dataset hash</b>{shortHash(latest.dataset_hash)}</span><span><b>Formula hash</b>{shortHash(latest.formula_hash)}</span><span><b>Calculation hash</b>{shortHash(latest.calculation_hash)}</span><span><b>Provenance version</b>{display(latest.provenance_version)}</span></div><small className="ccc-note">Hashes and trace are provenance references. They do not constitute government issuance, registry consensus, or settlement confirmation.</small></article></div></> : <div className="ccc-empty"><strong>No authoritative carbon calculation is available for this organization.</strong><span>Complete activity → measurement → evidence → approved verification → registered methodology before calculating value.</span></div>}
    <div className="ccc-actions"><button type="button" onClick={() => jump("mrv & evidence")}>Review MRV & evidence</button><button type="button" onClick={() => jump("compliance & epr")}>Check compliance</button><button type="button" onClick={() => jump("registry")}>Open registry</button><button type="button" onClick={() => jump("settlement")}>Open settlement</button><button type="button" onClick={() => jump("esg / brsr")}>Open ESG / BRSR</button></div>
  </section>;
}

const mount = document.getElementById("carbon-command-center"); if (mount) createRoot(mount).render(<Panel />);
