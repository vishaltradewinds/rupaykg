import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const DRAFT_KEY = "rupaykg.fieldCaptureDrafts";
const PANEL_ID = "rupaykg-field-capture";
const ORG_KEY = "rupaykg.activeOrganizationId";

type Geography = { id: string; kind?: string; name?: string; code?: string; parent_id?: string | null };
type Draft = { id: string; context: OperatingContext; activityType: string; material: string; quantity: string; unit: string; geography: string; geographyId?: string; notes: string; capturedAt: string; syncStatus: "LOCAL_DRAFT" | "QUEUED" | "SYNCED" | "REJECTED" };

const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const firebaseApp = firebaseConfigured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
let sessionToken = "";
let identityId = "";
let organizationId = "";
let verifiedDeviceId = "";
let geographies: Geography[] = [];

function drafts(): Draft[] { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]") as Draft[]; } catch { return []; } }
function saveDraft(draft: Draft) { localStorage.setItem(DRAFT_KEY, JSON.stringify([draft, ...drafts().filter(d => d.id !== draft.id)].slice(0, 100))); }
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (text) node.textContent = text; return node; }

async function establishSession(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Authentication failed (${response.status})`);
  sessionToken = String(body.sessionToken || "");
  const verified = (Array.isArray(body.memberships) ? body.memberships : []).filter((m: any) => m?.status === "VERIFIED");
  const selected = localStorage.getItem(ORG_KEY) || "";
  organizationId = String(verified.find((m: any) => m.organization_id === selected)?.organization_id || verified[0]?.organization_id || "");
  if (organizationId) localStorage.setItem(ORG_KEY, organizationId);
  identityId = String(body.identity?.id || "");
}

async function loadAuthoritativeInputs() {
  if (!sessionToken || !organizationId) return;
  const headers = { Authorization: `Bearer ${sessionToken}`, Accept: "application/json", "X-RupayKG-Organization-Id": organizationId };
  const [devicesResponse, geographyResponse] = await Promise.all([fetch("/api/v1/field-devices", { headers }), fetch("/api/v1/geography/roots", { headers })]);
  if (devicesResponse.ok) {
    const body = await devicesResponse.json().catch(() => ({}));
    const devices = Array.isArray(body.devices) ? body.devices : [];
    const mine = devices.find((d: any) => d?.identity_id === identityId && d?.status === "VERIFIED");
    verifiedDeviceId = String(mine?.id || "");
  }
  if (geographyResponse.ok) {
    const body = await geographyResponse.json().catch(() => ({}));
    geographies = Array.isArray(body?.data?.geography) ? body.data.geography : [];
  }
}

async function submitAuthoritative(draft: Draft): Promise<{ queued: boolean; synced: boolean; entityId?: string }> {
  if (!sessionToken || !organizationId || !verifiedDeviceId) throw new Error("A verified field device is required before authoritative field sync.");
  if (!draft.geographyId) throw new Error("Select an authorized geography before submitting.");
  const idempotencyKey = `field-capture:${draft.id}`;
  const payload = { operationType: "ACTIVITY_CREATE", organizationId, activityType: draft.activityType, occurredAt: draft.capturedAt, geographyId: draft.geographyId, metadata: { operatingContext: draft.context, material: draft.material, declaredQuantity: Number(draft.quantity), declaredUnit: draft.unit, fieldNotes: draft.notes, captureSource: "RupayKG field capture" } };
  const response = await fetch("/api/v1/operations/sync", { method: "POST", headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json", Accept: "application/json", "X-RupayKG-Organization-Id": organizationId }, body: JSON.stringify({ idempotencyKey, deviceId: verifiedDeviceId, capturedAt: draft.capturedAt, clientSequence: Date.now(), payload }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Field sync failed (${response.status})`);
  if (body?.queued === true) return { queued: true, synced: false };
  const entityId = typeof body?.entityId === "string" ? body.entityId : typeof body?.operation?.entityId === "string" ? body.operation.entityId : undefined;
  return { queued: false, synced: body?.authoritativeMutation === true || Boolean(entityId), entityId };
}

function render(context: OperatingContext = readOperatingContext()) {
  const config = getOperatingContextConfig(context);
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) { panel = el("section"); panel.id = PANEL_ID; panel.setAttribute("aria-label", "Field activity capture"); panel.style.cssText = "margin:12px 16px;padding:16px;border:1px solid rgba(87,211,255,.18);border-radius:16px;background:rgba(7,17,31,.94);color:#dbe7ef;font:500 12px/1.45 system-ui,sans-serif;"; shell.appendChild(panel); }
  panel.textContent = "";
  const heading = el("strong", `Field capture · ${config.label}`); heading.style.cssText = "display:block;font-size:15px;color:#e8f4fa;margin-bottom:3px"; panel.appendChild(heading); panel.appendChild(el("div", config.fieldFocus));
  const form = el("form"); form.style.cssText = "display:grid;gap:9px;margin-top:12px";
  const activity = el("select"); ["GENERATION", "AGGREGATION", "MEASUREMENT", "TRANSPORT", "PROCESSING"].forEach(v => activity.appendChild(el("option", v)));
  const material = el("select"); config.categories.forEach(v => material.appendChild(el("option", v)));
  const quantity = el("input"); quantity.type = "number"; quantity.min = "0"; quantity.step = "any"; quantity.placeholder = "Quantity"; quantity.required = true;
  const unit = el("select"); ["kg", "tonne", "litre", "unit"].forEach(v => unit.appendChild(el("option", v)));
  const geography = el("select"); geography.required = true; geography.appendChild(el("option", geographies.length ? "Select authorized geography" : "Sign in and select an authorized geography")); geography.options[0]!.disabled = true; geography.value = "";
  geographies.forEach(g => geography.appendChild(Object.assign(el("option", `${g.name || g.code || g.id}${g.kind ? ` · ${g.kind}` : ""}`), { value: g.id })));
  const notes = el("textarea"); notes.placeholder = "Optional field notes"; notes.rows = 2;
  const save = el("button", verifiedDeviceId ? "Submit field operation" : "Save field draft"); save.type = "submit"; save.style.cssText = "padding:10px 12px;border:0;border-radius:10px;background:#2d8cff;color:white;font-weight:700;cursor:pointer";
  const status = el("div", `${drafts().length} local draft(s) · ${verifiedDeviceId ? "Verified device connected to authoritative sync." : "Verified field device required for authoritative sync."}`); status.style.cssText = "margin-top:7px;opacity:.75";
  [activity, material, quantity, unit, geography, notes].forEach(input => input.style.cssText = "width:100%;box-sizing:border-box;padding:9px 10px;border-radius:9px;border:1px solid rgba(87,211,255,.18);background:#0b1825;color:#dbe7ef");
  form.append(activity, material, quantity, unit, geography, notes, save, status); panel.appendChild(form);
  form.addEventListener("submit", event => { event.preventDefault(); const draft: Draft = { id: crypto.randomUUID(), context, activityType: activity.value, material: material.value, quantity: quantity.value, unit: unit.value, geography: geography.options[geography.selectedIndex]?.textContent || "", geographyId: geography.value || undefined, notes: notes.value.trim(), capturedAt: new Date().toISOString(), syncStatus: "LOCAL_DRAFT" }; if (!draft.quantity || Number(draft.quantity) <= 0) { status.textContent = "Enter a positive quantity."; return; } saveDraft(draft); void (async () => { try { const result = await submitAuthoritative(draft); draft.syncStatus = result.synced ? "SYNCED" : result.queued ? "QUEUED" : "LOCAL_DRAFT"; saveDraft(draft); status.textContent = result.synced ? `Authoritative activity accepted${result.entityId ? ` · ${result.entityId}` : ""}.` : result.queued ? "Field operation queued for authoritative sync." : "Field draft saved."; quantity.value = ""; geography.value = ""; notes.value = ""; } catch (cause) { status.textContent = `${cause instanceof Error ? cause.message : "Submission failed"} Draft retained on this device.`; } })(); });
}

function mount() {
  render();
  if (firebaseAuth) onAuthStateChanged(firebaseAuth, async user => { if (!user) { sessionToken = ""; verifiedDeviceId = ""; return; } try { await establishSession(user); await loadAuthoritativeInputs(); render(); } catch {} });
  window.addEventListener("rupaykg:operating-context-change", event => render((event as CustomEvent<OperatingContext>).detail === "rural" ? "rural" : "urban"));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
