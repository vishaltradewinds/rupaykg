import React from "react";
import { createRoot } from "react-dom/client";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import "./styles.css";

type Device = {
  id: string;
  device_id: string;
  identity_id: string;
  organization_id: string;
  registered_by_identity_id?: string;
  registered_at?: string;
  verified_by_identity_id?: string | null;
  verified_at?: string | null;
  last_seen_at?: string | null;
  status: string;
};
type Membership = { organization_id: string; organization_name: string; status: string };
type Me = { identity: { id: string } | null; memberships?: Membership[] };

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

async function sessionFor(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Authentication failed (${response.status})`);
  return String(body.sessionToken);
}

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) { return <label className="form-field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>; }

function Panel() {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState("");
  const [identityId, setIdentityId] = React.useState("");
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [organizationId, setOrganizationId] = React.useState(() => localStorage.getItem(organizationStorageKey) ?? "");
  const [deviceId, setDeviceId] = React.useState("");
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const activeMembership = memberships.find(m => m.organization_id === organizationId && m.status === "VERIFIED");
  const canEnrollForActiveOrganization = Boolean(activeMembership && identityId);

  const load = React.useCallback(async (session: string) => {
    const response = await fetch("/api/v1/field-devices", { headers: { Authorization: `Bearer ${session}`, Accept: "application/json" } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error ?? `Field-device inventory failed (${response.status})`);
    setDevices(Array.isArray(body.devices) ? body.devices : []);
  }, []);

  React.useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async currentUser => {
      setUser(currentUser);
      if (!currentUser) { setToken(""); setDevices([]); setMemberships([]); setIdentityId(""); return; }
      try {
        const session = await sessionFor(currentUser);
        setToken(session);
        const meResponse = await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${session}`, Accept: "application/json" } });
        const me = await meResponse.json().catch(() => ({})) as Me;
        setIdentityId(me.identity?.id ?? "");
        setMemberships((me.memberships ?? []).filter(m => m.status === "VERIFIED"));
        setOrganizationId(localStorage.getItem(organizationStorageKey) ?? "");
        await load(session);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load field-device governance."); }
    });
  }, [load]);

  React.useEffect(() => {
    const sync = () => setOrganizationId(localStorage.getItem(organizationStorageKey) ?? "");
    window.addEventListener("storage", sync);
    const timer = window.setInterval(sync, 1000);
    return () => { window.removeEventListener("storage", sync); window.clearInterval(timer); };
  }, []);

  if (!user || !token) return null;

  async function enroll() {
    if (!canEnrollForActiveOrganization || !deviceId.trim()) { setError("Select a verified active organization and provide a device identifier."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/v1/field-devices/enroll", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ organizationId, deviceId: deviceId.trim(), identityId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? `Enrollment failed (${response.status})`);
      setMessage("Field device enrolled as PENDING. A permitted manager must verify it before field sync can use it.");
      setDeviceId("");
      await load(token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Field-device enrollment failed."); }
    finally { setBusy(false); }
  }

  async function verify(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/v1/field-devices/${id}/verify`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: "{}" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? `Verification failed (${response.status})`);
      setMessage("Field device verified. It can now be used for authoritative field sync by its enrolled identity.");
      await load(token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Field-device verification failed."); }
    finally { setBusy(false); }
  }

  return <section className="review-panel" aria-label="Field-device governance">
    <div className="section-heading"><div><p className="eyebrow">FIELD DEVICE GOVERNANCE</p><h2>Enroll and verify field devices</h2></div><span>{devices.length} device{devices.length === 1 ? "" : "s"}</span></div>
    <p className="field-help">Device enrollment and verification are authoritative backend mutations. Enrollment creates PENDING state; only a permitted organization manager can verify a device.</p>
    {error && <div className="notice error" role="alert">{error}</div>}
    {message && <div className="notice success" role="status">{message}</div>}
    <div className="onboarding-form">
      <Field label="Active organization"><input value={activeMembership?.organization_name ?? organizationId} readOnly placeholder="Select an active organization above" /></Field>
      <Field label="Enrolled identity" help="This first-stage workflow enrolls the authenticated identity. The backend independently requires verified organization membership.">
        <input value={identityId} readOnly aria-label="Authenticated enrolled identity" />
      </Field>
      <Field label="Device identifier"><input value={deviceId} onChange={e => setDeviceId(e.target.value)} maxLength={200} placeholder="Device identifier / hardware UUID" /></Field>
      <button type="button" onClick={() => void enroll()} disabled={busy || !canEnrollForActiveOrganization || !deviceId.trim()}>Enroll field device</button>
    </div>
    <div className="source-list">
      {devices.length === 0 ? <div className="empty">No field devices are visible for the current authenticated identity and organization scope.</div> : devices.map(device => <article className="source-row" key={device.id}>
        <div><strong>{device.device_id}</strong><p>{device.identity_id} · registered {device.registered_at ? new Date(device.registered_at).toLocaleString() : "—"}</p><small>Device record: {device.id}</small></div>
        <div className="button-row"><span className="status-pill">{device.status}</span>{device.status === "PENDING" && <button type="button" onClick={() => void verify(device.id)} disabled={busy}>Verify</button>}</div>
      </article>)}
    </div>
  </section>;
}

const mount = document.createElement("div");
mount.id = "field-device-management";
document.body.appendChild(mount);
createRoot(mount).render(<Panel />);