import { getApps, getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const PANEL_ID = "rupaykg-operating-dashboard";
const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const firebaseApp = firebaseConfigured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
let sessionToken = "";
let refreshTimer = 0;

type Overview = { source: string; syntheticData: boolean; counts: Record<string, number> };

function ensurePanel(): HTMLElement {
  const shell = document.querySelector(".app-shell") ?? document.body;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "RupayKG operating dashboard");
    Object.assign(panel.style, { margin: "12px 16px", padding: "16px", border: "1px solid rgba(87,211,255,.18)", borderRadius: "16px", background: "rgba(7,17,31,.94)", color: "#dbe7ef", font: "500 12px/1.45 system-ui,sans-serif" });
    shell.appendChild(panel);
  }
  return panel;
}

function card(label: string, value: string): HTMLElement {
  const node = document.createElement("article");
  Object.assign(node.style, { padding: "10px", borderRadius: "11px", border: "1px solid rgba(87,211,255,.13)", background: "rgba(11,24,37,.75)" });
  const l = document.createElement("div"); l.textContent = label; Object.assign(l.style, { fontSize: "10px", textTransform: "uppercase", letterSpacing: ".06em", opacity: ".62", marginBottom: "4px" });
  const v = document.createElement("div"); v.textContent = value; Object.assign(v.style, { fontWeight: "700", fontSize: "16px" });
  node.append(l, v); return node;
}

function render(context: OperatingContext = readOperatingContext(), overview?: Overview, error?: string): void {
  const config = getOperatingContextConfig(context);
  const panel = ensurePanel(); panel.textContent = "";
  const title = document.createElement("strong"); title.textContent = `${config.label} operating dashboard`; Object.assign(title.style, { display: "block", fontSize: "17px", color: "#e8f4fa", marginBottom: "3px" }); panel.appendChild(title);
  const subtitle = document.createElement("div"); subtitle.textContent = `${config.anchor} · ${config.unit} · ${config.waste}`; Object.assign(subtitle.style, { opacity: ".78", marginBottom: "12px" }); panel.appendChild(subtitle);

  const contextGrid = document.createElement("div"); Object.assign(contextGrid.style, { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "8px" });
  [["Operating geography", config.geography], ["Primary actor", config.actor], ["Field focus", config.fieldFocus], ["Analytics", config.analytics]].forEach(([label, value]) => contextGrid.appendChild(card(label, value)));
  panel.appendChild(contextGrid);

  const heading = document.createElement("div"); heading.textContent = "Authoritative operating totals"; Object.assign(heading.style, { marginTop: "14px", marginBottom: "8px", fontWeight: "700", fontSize: "13px" }); panel.appendChild(heading);
  const dataGrid = document.createElement("div"); Object.assign(dataGrid.style, { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))", gap: "8px" });
  const counts = overview?.counts ?? {};
  [["Activities", counts.activities], ["Measurements", counts.measurements], ["Evidence", counts.evidence], ["Approved verification", counts.approvedVerifications], ["Credentials", counts.issuedOrActiveCredentials], ["Settled transactions", counts.settledTransactions]].forEach(([label, value]) => dataGrid.appendChild(card(String(label), overview ? String(value ?? 0) : "—")));
  panel.appendChild(dataGrid);

  const source = document.createElement("div"); source.textContent = overview ? `Source: ${overview.source} · syntheticData=${overview.syntheticData ? "true" : "false"}` : error ? `Authoritative data unavailable: ${error}` : "Authenticating…"; Object.assign(source.style, { marginTop: "9px", opacity: ".72", fontSize: "11px" }); panel.appendChild(source);
  const flow = document.createElement("div"); flow.textContent = "Capture → Measure → Evidence → Verify → Provenance → Registry → Value"; Object.assign(flow.style, { marginTop: "12px", padding: "9px 10px", borderRadius: "10px", background: "rgba(45,140,255,.08)", border: "1px solid rgba(45,140,255,.16)", fontWeight: "700" }); panel.appendChild(flow);
  const note = document.createElement("div"); note.textContent = context === "rural" ? "Rural mode prioritizes village-level biomass capture and offline field operations." : "Urban mode prioritizes ward-level MSW capture, collection and material recovery flows."; Object.assign(note.style, { marginTop: "8px", opacity: ".72" }); panel.appendChild(note);
}

async function establishSession(user: User): Promise<void> {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body?.sessionToken !== "string" || !body.sessionToken) throw new Error(body?.error ?? `Authentication failed (${response.status})`);
  sessionToken = body.sessionToken;
}

async function loadOverview(context: OperatingContext = readOperatingContext()): Promise<void> {
  if (!sessionToken) { render(context); return; }
  const organizationId = localStorage.getItem("rupaykg.activeOrganizationId") || "";
  const headers = { Authorization: `Bearer ${sessionToken}`, Accept: "application/json", ...(organizationId ? { "X-RupayKG-Organization-Id": organizationId } : {}) };
  try {
    const response = await fetch("/api/v1/overview", { headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error ?? `Overview failed (${response.status})`);
    render(context, body as Overview);
  } catch (cause) { render(context, undefined, cause instanceof Error ? cause.message : "Unable to load authoritative overview"); }
}

function mount(): void {
  render();
  if (firebaseAuth) onAuthStateChanged(firebaseAuth, async user => { sessionToken = ""; if (!user) { render(); return; } try { await establishSession(user); await loadOverview(); } catch (cause) { render(readOperatingContext(), undefined, cause instanceof Error ? cause.message : "Authentication unavailable"); } });
  window.addEventListener("rupaykg:operating-context-change", event => { const context = (event as CustomEvent<OperatingContext>).detail === "rural" ? "rural" : "urban"; void loadOverview(context); });
  window.addEventListener("storage", event => { if (event.key === "rupaykg.activeOrganizationId") void loadOverview(); });
  refreshTimer = window.setInterval(() => { if (sessionToken) void loadOverview(); }, 60000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
