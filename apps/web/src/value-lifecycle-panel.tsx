import React from "react";
import { createRoot } from "react-dom/client";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import "./styles.css";

type Me = {
  identity: { id: string } | null;
  memberships: Array<{ organization_id: string; organization_name: string; status: string; permissions: string[] }>;
};

type MutationDetail = { url: string; method: string; body: Record<string, unknown> };

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const configured = Object.values(firebaseConfig).every(Boolean);
const firebaseApp = configured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const organizationStorageKey = "rupaykg.activeOrganizationId";

function installMutationBridge() {
  const key = "__rupaykgMutationBridgeInstalled";
  const target = window as unknown as Record<string, unknown>;
  if (target[key]) return;
  target[key] = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const response = await original(input, init);
    if (["POST", "PUT", "PATCH"].includes(method) && response.ok && url.includes("/api/v1/")) {
      response.clone().json().then(body => window.dispatchEvent(new CustomEvent<MutationDetail>("rupaykg:authoritative-mutation", { detail: { url, method, body } }))).catch(() => undefined);
    }
    return response;
  };
}

async function sessionFor(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Authentication failed (${response.status})`);
  return String(body.sessionToken);
}

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return <label className="form-field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}

function Panel() {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState("");
  const [me, setMe] = React.useState<Me | null>(null);
  const [organizationId, setOrganizationId] = React.useState(() => localStorage.getItem(organizationStorageKey) ?? "");
  const [activityId, setActivityId] = React.useState("");
  const [evidenceId, setEvidenceId] = React.useState("");
  const [verificationId, setVerificationId] = React.useState("");
  const [calculationId, setCalculationId] = React.useState("");
  const [credentialId, setCredentialId] = React.useState("");
  const [settlementId, setSettlementId] = React.useState("");
  const [verificationScope, setVerificationScope] = React.useState("MRV");
  const [methodologyCode, setMethodologyCode] = React.useState("");
  const [methodologyVersion, setMethodologyVersion] = React.useState("");
  const [baselineTco2e, setBaselineTco2e] = React.useState("");
  const [projectTco2e, setProjectTco2e] = React.useState("");
  const [leakageTco2e, setLeakageTco2e] = React.useState("0");
  const [uncertaintyTco2e, setUncertaintyTco2e] = React.useState("0");
  const [trustRootId, setTrustRootId] = React.useState("");
  const [credentialQuantity, setCredentialQuantity] = React.useState("");
  const [credentialUnit, setCredentialUnit] = React.useState("tCO2e");
  const [targetOrganizationId, setTargetOrganizationId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("INR");
  const [authorizationReference, setAuthorizationReference] = React.useState("");
  const [externalReference, setExternalReference] = React.useState("");
  const [confirmationReference, setConfirmationReference] = React.useState("");
  const [reconciliationReference, setReconciliationReference] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [lastEvent, setLastEvent] = React.useState("");

  const activeMembership = me?.memberships.find(m => m.status === "VERIFIED" && m.organization_id === organizationId);
  const permissions = new Set(activeMembership?.permissions ?? []);
  const canVerify = ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"].some(p => permissions.has(p));
  const canManageProjects = permissions.has("projects:manage");
  const canIssue = ["ISSUE_CREDENTIAL", "registry:issue", "registry.issue"].some(p => permissions.has(p));
  const canAuthorize = ["AUTHORIZE_SETTLEMENT", "settlement:authorize", "settlement.authorize"].some(p => permissions.has(p));
  const canSettle = ["SETTLE_FUNDS", "settlement:settle", "settlement.settle"].some(p => permissions.has(p));

  const api = React.useCallback(async <T,>(path: string, init: RequestInit): Promise<T> => {
    const response = await fetch(path, { ...init, headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
    return body as T;
  }, [token]);

  React.useEffect(() => { installMutationBridge(); }, []);

  React.useEffect(() => {
    const sync = () => setOrganizationId(localStorage.getItem(organizationStorageKey) ?? "");
    window.addEventListener("storage", sync);
    const timer = window.setInterval(sync, 1000);
    return () => { window.removeEventListener("storage", sync); window.clearInterval(timer); };
  }, []);

  React.useEffect(() => {
    const onMutation = (event: Event) => {
      const detail = (event as CustomEvent<MutationDetail>).detail;
      const body = detail.body as Record<string, any>;
      if (detail.url.includes("/operations/sync")) {
        const op = body.operation;
        if (op?.entityType === "activity" && op.entityId) setActivityId(String(op.entityId));
        if (op?.entityType === "evidence" && op.entityId) setEvidenceId(String(op.entityId));
        setLastEvent(`Captured authoritative ${String(op?.entityType ?? "operation")} ${String(op?.entityId ?? "")}`);
      } else if (detail.url.includes("/evidence/") && detail.url.endsWith("/verification")) {
        if (body.verification?.id) setVerificationId(String(body.verification.id));
        setLastEvent("Captured approved verification");
      } else if (detail.url.includes("/carbon/calculations")) {
        if (body.calculation?.id) setCalculationId(String(body.calculation.id));
        setLastEvent("Captured carbon calculation");
      } else if (detail.url === "/api/v1/credentials" && body.credential?.id) {
        setCredentialId(String(body.credential.id));
        setLastEvent("Captured issued credential");
      } else if (detail.url.includes("/credentials/") && detail.url.endsWith("/activate") && body.credential?.id) {
        setCredentialId(String(body.credential.id));
        setLastEvent("Credential activated");
      } else if (detail.url === "/api/v1/settlements" && body.settlement?.id) {
        setSettlementId(String(body.settlement.id));
        setLastEvent("Captured settlement");
      }
    };
    window.addEventListener("rupaykg:authoritative-mutation", onMutation);
    return () => window.removeEventListener("rupaykg:authoritative-mutation", onMutation);
  }, []);

  React.useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async currentUser => {
      setUser(currentUser);
      if (!currentUser) { setToken(""); setMe(null); return; }
      try {
        const session = await sessionFor(currentUser);
        setToken(session);
        const response = await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${session}`, Accept: "application/json" } });
        const body = await response.json().catch(() => ({})) as Me;
        if (!response.ok) throw new Error((body as any)?.error ?? "Unable to load authenticated organization context.");
        setMe(body);
        setOrganizationId(localStorage.getItem(organizationStorageKey) ?? body.memberships.find(m => m.status === "VERIFIED")?.organization_id ?? "");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load lifecycle controls."); }
    });
  }, []);

  if (!user || !token) return null;

  async function action(label: string, fn: () => Promise<unknown>) {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); setMessage(`${label} accepted by the authoritative API.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `${label} failed.`); }
    finally { setBusy(false); }
  }

  const jsonPost = (path: string, body: Record<string, unknown>) => api(path, { method: "POST", body: JSON.stringify(body) });

  return <section className="review-panel" aria-label="Carbon registry settlement lifecycle">
    <div className="section-heading"><div><p className="eyebrow">VALUE LIFECYCLE HANDOFF</p><h2>Carbon → Registry → Settlement</h2></div><span>{lastEvent || "Authoritative IDs auto-carry"}</span></div>
    <p className="field-help">Successful backend mutations from the existing MRV console are captured in-browser and carried into the next governed step. No authoritative ID is fabricated or inferred.</p>
    {error && <div className="notice error" role="alert">{error}</div>}
    {message && <div className="notice success" role="status">{message}</div>}

    <div className="onboarding-form">
      <Field label="Active organization"><input value={activeMembership?.organization_name ?? organizationId} readOnly /></Field>
      <Field label="Activity ID" help="Automatically captured after authoritative activity creation."><input value={activityId} onChange={e => setActivityId(e.target.value)} placeholder="Waiting for MRV activity" /></Field>
      <Field label="Evidence ID" help="Automatically captured after authoritative evidence creation."><input value={evidenceId} onChange={e => setEvidenceId(e.target.value)} placeholder="Waiting for evidence" /></Field>
      <Field label="Verification scope"><input value={verificationScope} onChange={e => setVerificationScope(e.target.value)} /></Field>
      <button type="button" disabled={busy || !canVerify || !evidenceId} onClick={() => void action("Evidence verification", async () => { const result = await jsonPost(`/api/v1/evidence/${evidenceId}/verification`, { decision: "APPROVED", scope: verificationScope.trim() }); if ((result as any).verification?.id) setVerificationId(String((result as any).verification.id)); })}>Verify evidence</button>
    </div>

    <div className="onboarding-form">
      <Field label="Methodology code"><input value={methodologyCode} onChange={e => setMethodologyCode(e.target.value)} placeholder="Registered methodology code" /></Field>
      <Field label="Methodology version"><input value={methodologyVersion} onChange={e => setMethodologyVersion(e.target.value)} placeholder="Registered version" /></Field>
      <Field label="Baseline tCO2e"><input inputMode="decimal" value={baselineTco2e} onChange={e => setBaselineTco2e(e.target.value)} /></Field>
      <Field label="Project tCO2e"><input inputMode="decimal" value={projectTco2e} onChange={e => setProjectTco2e(e.target.value)} /></Field>
      <Field label="Leakage tCO2e"><input inputMode="decimal" value={leakageTco2e} onChange={e => setLeakageTco2e(e.target.value)} /></Field>
      <Field label="Uncertainty tCO2e"><input inputMode="decimal" value={uncertaintyTco2e} onChange={e => setUncertaintyTco2e(e.target.value)} /></Field>
      <Field label="Approved verification ID"><input value={verificationId} readOnly placeholder="Captured after verification" /></Field>
      <button type="button" disabled={busy || !canManageProjects || !activityId || !evidenceId || !verificationId || !methodologyCode || !methodologyVersion} onClick={() => void action("Carbon calculation", async () => { const result = await jsonPost("/api/v1/carbon/calculations", { activityId, methodologyCode, methodologyVersion, evidenceId, baselineTco2e: Number(baselineTco2e), projectTco2e: Number(projectTco2e), leakageTco2e: Number(leakageTco2e), uncertaintyTco2e: Number(uncertaintyTco2e) }); if ((result as any).calculation?.id) setCalculationId(String((result as any).calculation.id)); })}>Calculate authoritative value</button>
      {calculationId && <small>Calculation: {calculationId}</small>}
    </div>

    <div className="onboarding-form">
      <Field label="Trust root ID"><input value={trustRootId} onChange={e => setTrustRootId(e.target.value)} placeholder="Authoritative trust-root reference" /></Field>
      <Field label="Credential quantity"><input inputMode="decimal" value={credentialQuantity} onChange={e => setCredentialQuantity(e.target.value)} /></Field>
      <Field label="Credential unit"><input value={credentialUnit} onChange={e => setCredentialUnit(e.target.value)} /></Field>
      <Field label="Credential ID"><input value={credentialId} readOnly placeholder="Captured after issuance" /></Field>
      <button type="button" disabled={busy || !canIssue || !activityId || !verificationId || !trustRootId || !credentialQuantity} onClick={() => void action("Credential issuance", async () => { const result = await jsonPost("/api/v1/credentials", { activityId, trustRootId, verificationId, issuerOrganizationId: organizationId, quantity: Number(credentialQuantity), unit: credentialUnit }); if ((result as any).credential?.id) setCredentialId(String((result as any).credential.id)); })}>Issue credential</button>
      <button type="button" className="secondary" disabled={busy || !canIssue || !credentialId} onClick={() => void action("Credential activation", async () => { await jsonPost(`/api/v1/credentials/${credentialId}/activate`, {}); })}>Activate credential</button>
    </div>

    <div className="onboarding-form">
      <Field label="Settlement payee organization ID"><input value={targetOrganizationId} onChange={e => setTargetOrganizationId(e.target.value)} placeholder="Destination organization UUID" /></Field>
      <Field label="Settlement amount"><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
      <Field label="Currency"><input maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} /></Field>
      <Field label="External payment reference"><input value={externalReference} onChange={e => setExternalReference(e.target.value)} placeholder="Provider/bank reference" /></Field>
      <button type="button" disabled={busy || !credentialId || !organizationId || !targetOrganizationId || !amount} onClick={() => void action("Settlement creation", async () => { const result = await jsonPost("/api/v1/settlements", { credentialId, payerId: organizationId, payeeId: targetOrganizationId, amount: Number(amount), currency, externalReference: externalReference || undefined }); if ((result as any).settlement?.id) setSettlementId(String((result as any).settlement.id)); })}>Create settlement</button>
      <Field label="Authorization reference"><input value={authorizationReference} onChange={e => setAuthorizationReference(e.target.value)} /></Field>
      <button type="button" className="secondary" disabled={busy || !canAuthorize || !settlementId || !authorizationReference} onClick={() => void action("Settlement authorization", async () => { await jsonPost(`/api/v1/settlements/${settlementId}/authorize`, { authorizationReference }); })}>Authorize settlement</button>
      <button type="button" className="secondary" disabled={busy || !canSettle || !settlementId || !externalReference} onClick={() => void action("External settlement", async () => { await jsonPost(`/api/v1/settlements/${settlementId}/settle`, { externalReference }); })}>Execute settlement</button>
      <Field label="Confirmation reference"><input value={confirmationReference} onChange={e => setConfirmationReference(e.target.value)} /></Field>
      <Field label="Reconciliation reference"><input value={reconciliationReference} onChange={e => setReconciliationReference(e.target.value)} /></Field>
      <button type="button" className="secondary" disabled={busy || !canSettle || !settlementId || !confirmationReference || !reconciliationReference} onClick={() => void action("Settlement confirmation", async () => { await jsonPost(`/api/v1/settlements/${settlementId}/confirm`, { confirmationReference, reconciliationReference }); })}>Confirm and reconcile</button>
    </div>
  </section>;
}

const mount = document.createElement("div");
mount.id = "value-lifecycle-management";
document.body.appendChild(mount);
createRoot(mount).render(<Panel />);
