import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { initializeApp } from "firebase/app";
import "./styles.css";

type Obligation = {
  id: string;
  organization_id: string;
  organization_name: string;
  jurisdiction_id: string | null;
  jurisdiction_name: string | null;
  obligation_type: string;
  period_start: string;
  period_end: string;
  required_quantity: number | string;
  status: string;
};

type Membership = { organization_id: string; status: string; can_assess_epr?: boolean; permissions?: string[] };
type Me = { memberships: Membership[] };
type PanelState = { status: string; message: string; obligations: Obligation[]; canAssess: boolean };

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const firebaseAuth = firebaseConfigured ? getAuth(initializeApp(firebaseConfig, "compliance-assessment")) : null;
const root = document.getElementById("compliance-assessment");

async function api<T>(path: string, token = "", init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}

function text(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function escapeHtml(value: unknown) {
  return text(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

if (root && firebaseAuth) {
  const render = (state: PanelState) => {
    const rows = state.obligations.length
      ? state.obligations.map((obligation) => `
        <article class="compliance-row">
          <div>
            <strong>${escapeHtml(obligation.obligation_type)}</strong>
            <span>${escapeHtml(obligation.organization_name)} · ${escapeHtml(obligation.jurisdiction_name)} · ${escapeHtml(formatDate(obligation.period_start))} – ${escapeHtml(formatDate(obligation.period_end))}</span>
            <small>Status: ${escapeHtml(obligation.status)} · Required quantity: ${escapeHtml(obligation.required_quantity)}</small>
          </div>
          ${state.canAssess ? `<button data-assess="${escapeHtml(obligation.id)}">Assess obligation</button>` : `<span class="field-help">Assessment permission not granted</span>`}
        </article>`).join("")
      : `<div class="empty">No authorized obligations are available for assessment.</div>`;

    root.innerHTML = `
      <section class="compliance-card">
        <div class="compliance-head">
          <div>
            <p class="eyebrow">AUTHORITATIVE COMPLIANCE</p>
            <h2>EPR obligation assessment</h2>
            <p>Assess an existing obligation through the production API. No quantities or obligation state are synthesized in the browser.</p>
          </div>
          <span class="compliance-state">${escapeHtml(state.status)}</span>
        </div>
        ${state.message ? `<div class="resource-flow-state">${escapeHtml(state.message)}</div>` : ""}
        <div class="compliance-list">${rows}</div>
      </section>`;

    root.querySelectorAll<HTMLButtonElement>("[data-assess]").forEach((button) => {
      button.addEventListener("click", () => void assess(button.dataset.assess!, state));
    });
  };

  const assess = async (id: string, state: PanelState) => {
    const button = root.querySelector<HTMLButtonElement>(`[data-assess="${id}"]`);
    if (button) button.disabled = true;
    try {
      const user = firebaseAuth.currentUser;
      if (!user || !user.emailVerified) throw new Error("Verified Firebase sign-in is required.");
      const idToken = await user.getIdToken(true);
      const session = await api<{ sessionToken: string }>("/api/v1/auth/exchange", "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const me = await api<Me>("/api/v1/auth/me", session.sessionToken);
      const membership = me.memberships.find((candidate) => candidate.status === "VERIFIED");
      if (!membership) throw new Error("A verified organization membership is required.");
      if (membership.can_assess_epr !== true) throw new Error("EPR assessment permission is not granted for the active organization membership.");
      const result = await api<{ assessment?: { status?: string; requiredQuantity?: number | string } }>(
        `/api/v1/epr/obligations/${id}/assess`, session.sessionToken, { method: "POST" },
      );
      state.message = `Authoritative assessment completed: ${text(result.assessment?.status)} · required quantity ${text(result.assessment?.requiredQuantity)}`;
      const workspace = await api<{ data: { obligations: Obligation[] } }>("/api/v1/workspaces/compliance", session.sessionToken);
      state.obligations = workspace.data.obligations ?? [];
      state.status = "READY";
    } catch (error) {
      state.message = error instanceof Error ? error.message : "Compliance assessment failed.";
    }
    render(state);
  };

  const load = async (user: User) => {
    try {
      if (!user.emailVerified) throw new Error("Verify your email address before using compliance assessment.");
      const idToken = await user.getIdToken(true);
      const session = await api<{ sessionToken: string }>("/api/v1/auth/exchange", "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const me = await api<Me>("/api/v1/auth/me", session.sessionToken);
      const membership = me.memberships.find((candidate) => candidate.status === "VERIFIED");
      if (!membership) throw new Error("A verified organization membership is required.");
      const workspace = await api<{ data: { obligations: Obligation[] } }>("/api/v1/workspaces/compliance", session.sessionToken);
      render({ status: "READY", message: membership.can_assess_epr === true ? "Assessments use authoritative obligation and verified-credit records." : "Compliance obligations are visible, but EPR assessment permission is not granted.", obligations: workspace.data.obligations ?? [], canAssess: membership.can_assess_epr === true });
    } catch (error) {
      render({ status: "UNAVAILABLE", message: error instanceof Error ? error.message : "Unable to load authoritative compliance data.", obligations: [], canAssess: false });
    }
  };

  onAuthStateChanged(firebaseAuth, (user) => {
    if (user) void load(user);
    else render({ status: "SIGN IN REQUIRED", message: "Sign in to load authorized compliance obligations.", obligations: [], canAssess: false });
  });
}

// Keep the authoritative compliance panel on the push-CI path so the complete production gate runs.
