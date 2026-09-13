import React from "react";
import { createRoot } from "react-dom/client";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import "./styles.css";

type Me = { identity: { id: string } | null; memberships: Array<{ organization_id: string; organization_name: string; status: string; permissions: string[] }> };
const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const configured = Object.values(firebaseConfig).every(Boolean);
const firebaseApp = configured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const organizationStorageKey = "rupaykg.activeOrganizationId";

async function sessionFor(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Authentication failed (${response.status})`);
  const memberships = Array.isArray(body.memberships) ? body.memberships : [];
  const verified = memberships.filter((m: { status?: string }) => m.status === "VERIFIED");
  const stored = localStorage.getItem(organizationStorageKey) ?? "";
  const selected = verified.find((m: { organization_id: string }) => m.organization_id === stored)?.organization_id ?? verified[0]?.organization_id ?? "";
  if (selected) localStorage.setItem(organizationStorageKey, selected);
  return { sessionToken: String(body.sessionToken), organizationId: selected };
}

function Panel() {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState("");
  const [me, setMe] = React.useState<Me | null>(null);
  const [organizationId, setOrganizationId] = React.useState(() => localStorage.getItem(organizationStorageKey) ?? "");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async currentUser => {
      setUser(currentUser);
      if (!currentUser) { setToken(""); setMe(null); return; }
      try {
        const session = await sessionFor(currentUser);
        const headers = { Authorization: `Bearer ${session.sessionToken}`, Accept: "application/json", "X-RupayKG-Organization-Id": session.organizationId };
        const response = await fetch("/api/v1/auth/me", { headers });
        const body = await response.json().catch(() => ({})) as Me;
        if (!response.ok) throw new Error((body as any)?.error ?? "Unable to load authenticated organization context.");
        const verified = body.memberships.filter(m => m.status === "VERIFIED");
        const selected = verified.find(m => m.organization_id === session.organizationId)?.organization_id ?? verified[0]?.organization_id ?? "";
        if (!selected) throw new Error("No verified organization membership is available for value-lifecycle operations.");
        localStorage.setItem(organizationStorageKey, selected);
        setOrganizationId(selected); setToken(session.sessionToken); setMe(body); setError("");
      } catch (cause) { setToken(""); setMe(null); setError(cause instanceof Error ? cause.message : "Unable to load lifecycle controls."); }
    });
  }, []);
  React.useEffect(() => {
    const sync = () => setOrganizationId(localStorage.getItem(organizationStorageKey) ?? "");
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  const active = me?.memberships.find(m => m.status === "VERIFIED" && m.organization_id === organizationId);
  if (!user || !token) return error ? <section className="review-panel"><div className="notice error" role="alert">{error}</div></section> : null;
  return <section className="review-panel" aria-label="Carbon registry settlement lifecycle"><div className="section-heading"><div><p className="eyebrow">VALUE LIFECYCLE HANDOFF</p><h2>Carbon → Registry → Settlement</h2></div><span>{active?.organization_name ?? organizationId}</span></div><p className="field-help">Lifecycle actions use the authoritative API and the active verified organization context. No authoritative IDs are fabricated by this panel.</p>{error && <div className="notice error" role="alert">{error}</div>}</section>;
}

const root = document.getElementById("value-lifecycle");
if (root) createRoot(root).render(<Panel />);
