import { getApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";

const rootId = "rupaykg-onboarding-governance";
const storageKey = "rupaykg.activeOrganizationId";
const fetchPatchKey = "__rupaykgOnboardingGovernanceFetchPatched";
let sessionToken = "";

function root() { let el = document.getElementById(rootId); if (!el) { el = document.createElement("section"); el.id = rootId; document.body.appendChild(el); } return el; }
function api(path: string, init: RequestInit = {}) { const headers = new Headers(init.headers); headers.set("Accept", "application/json"); if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`); const org = localStorage.getItem(storageKey); if (org) headers.set("X-RupayKG-Organization-Id", org); return fetch(path, { ...init, headers }).then(async r => { const body = await r.json().catch(() => ({})); if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`); return body; }); }
async function establishSession(user: User) { const idToken = await user.getIdToken(true); const exchanged = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken }) }); const body = await exchanged.json().catch(() => ({})); if (!exchanged.ok) throw new Error(body?.error || "Unable to establish RupayKG session"); sessionToken = body.sessionToken || ""; const verified = (body.memberships || []).filter((m: any) => m?.status === "VERIFIED"); if (!localStorage.getItem(storageKey) && verified[0]?.organization_id) localStorage.setItem(storageKey, verified[0].organization_id); }
function field(label: string, name: string, placeholder: string, required = false, type = "text") { const wrap = document.createElement("label"); wrap.className = "form-field"; const span = document.createElement("span"); span.textContent = `${label}${required ? " *" : ""}`; wrap.appendChild(span); const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input"); input.setAttribute("aria-label", label); input.dataset.governanceInput = name; input.placeholder = placeholder; if (type !== "textarea") (input as HTMLInputElement).type = type; if (required) input.required = true; if (type === "textarea") (input as HTMLTextAreaElement).rows = 2; wrap.appendChild(input); return wrap; }
function injectApplicantFields(form: HTMLFormElement) { if (!form || form.querySelector("[data-rupaykg-governance-fields]")) return; const box = document.createElement("fieldset"); box.dataset.rupaykgGovernanceFields = "true"; box.style.cssText = "margin:8px 0;padding:12px;border:1px solid #314c63;border-radius:12px"; const legend = document.createElement("legend"); legend.textContent = "Legal identity & verification evidence"; box.appendChild(legend); const note = document.createElement("p"); note.textContent = "Organization-backed stakeholders must complete legal verification before approval. These references do not constitute CPCB registration, statutory approval, or regulatory acceptance."; note.style.cssText = "font-size:12px;opacity:.78;line-height:1.4"; box.appendChild(note); box.append(field("Legal name", "legalName", "Registered legal name", true)); box.append(field("Legal form", "legalForm", "Company / LLP / Trust / ULB / etc.", true)); box.append(field("Registration identifier", "registrationIdentifier", "CIN / registration number / applicable identifier", true)); box.append(field("Registration authority", "registrationAuthority", "MCA / Registrar / ULB / competent authority", true)); box.append(field("Evidence type", "evidenceType", "Incorporation / registration / authorization", true)); box.append(field("Document reference", "documentReference", "Controlled document or repository reference", true)); box.append(field("Evidence content hash", "contentHash", "SHA-256 or controlled content hash", true)); box.append(field("Evidence issuer", "issuerName", "Issuing authority / institution")); box.append(field("Issued at", "issuedAt", "YYYY-MM-DD", false, "date")); box.append(field("Expires at", "expiresAt", "YYYY-MM-DD", false, "date")); form.insertBefore(box, form.querySelector("button[type=submit]") || null); }
function values() { const result: Record<string, string> = {}; document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-governance-input]").forEach(input => { if (input.dataset.governanceInput) result[input.dataset.governanceInput] = input.value.trim(); }); return result; }
function patchOnboardingFetch() {
  const scopedWindow = window as typeof window & { [fetchPatchKey]?: boolean };
  if (scopedWindow[fetchPatchKey]) return;
  const original = window.fetch.bind(window);
  scopedWindow[fetchPatchKey] = true;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    if (method.toUpperCase() === "POST" && url.includes("/api/v1/onboarding/applications") && !url.includes("/withdraw") && !url.includes("/approve") && !url.includes("/reject") && !url.includes("/verify-legal")) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (headers.get("Content-Type")?.includes("application/json") && typeof init?.body === "string") {
        const body = JSON.parse(init.body);
        Object.assign(body, values());
        init = { ...init, body: JSON.stringify(body), headers };
      }
    }
    return original(input, init);
  };
}
async function renderApplicantStatus() { if (!sessionToken) return; try { const me = await api("/api/v1/auth/me"); const pending = (me.applications || []).find((a: any) => a.status === "PENDING"); const target = document.querySelector(".onboarding-card"); if (!target || !pending) return; let banner = document.getElementById("rupaykg-legal-status"); if (!banner) { banner = document.createElement("div"); banner.id = "rupaykg-legal-status"; target.insertBefore(banner, target.querySelector(".auth-form") || target.firstChild); } banner.style.cssText = "margin:10px 0;padding:10px 12px;border:1px solid #314c63;border-radius:12px;font-size:12px;line-height:1.45"; banner.textContent = `Legal verification: ${pending.verification_status || "UNDER_REVIEW"} · Evidence records: ${pending.evidence_count ?? 0}. Operational approval remains blocked until an authorized reviewer verifies the organization.`; } catch { /* no synthetic status */ } }
async function renderReviewerQueue() {
  if (!sessionToken) return;
  try {
    const me = await api("/api/v1/auth/me");
    const reviewer = (me.memberships || []).some((m: any) => m.status === "VERIFIED" && ["platform_admin", "super_admin"].includes(m.role_name));
    if (!reviewer) return;
    const result = await api("/api/v1/onboarding/review-queue");
    const panel = root();
    panel.replaceChildren();
    panel.style.cssText = "max-width:980px;margin:18px auto;padding:0 16px";
    const heading = document.createElement("div");
    const headingTitle = document.createElement("strong"); headingTitle.textContent = "Legal verification queue"; heading.appendChild(headingTitle);
    const headingNote = document.createElement("div"); headingNote.textContent = "Review organization identity evidence before stakeholder approval. This does not represent statutory approval."; headingNote.style.cssText = "font-size:12px;opacity:.72;margin-top:4px"; heading.appendChild(headingNote); panel.appendChild(heading);
    for (const app of result.applications || []) {
      const card = document.createElement("article"); card.style.cssText = "margin-top:10px;padding:12px;border:1px solid #314c63;border-radius:12px";
      const name = document.createElement("strong"); name.textContent = String(app.organization_name || "Organization"); card.appendChild(name);
      const identity = document.createElement("div"); identity.textContent = `${String(app.requested_role_key)} · ${String(app.applicant_email || "")}`; identity.style.cssText = "font-size:12px;opacity:.78;margin:4px 0"; card.appendChild(identity);
      const legal = document.createElement("div"); legal.textContent = `Legal: ${String(app.legal_name || "—")} · ${String(app.legal_form || "—")} · ${String(app.registration_identifier || "—")} · Evidence: ${String(app.evidence_count ?? 0)}`; legal.style.fontSize = "12px"; card.appendChild(legal);
      const controls = document.createElement("div"); controls.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px";
      const note = document.createElement("input"); note.placeholder = "Verification rationale"; note.style.minWidth = "260px"; controls.appendChild(note);
      for (const decision of ["VERIFIED", "REJECTED"] as const) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = decision === "VERIFIED" ? "Verify legal identity" : "Reject legal evidence";
        button.onclick = async () => { if (!note.value.trim()) { alert("Verification rationale is required."); return; } button.disabled = true; try { await api(`/api/v1/onboarding/applications/${app.id}/verify-legal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verificationStatus: decision, verificationNote: note.value.trim() }) }); await renderReviewerQueue(); } catch (e) { alert(e instanceof Error ? e.message : "Legal verification failed"); button.disabled = false; } };
        controls.appendChild(button);
      }
      card.appendChild(controls); panel.appendChild(card);
    }
  } catch { /* inaccessible to non-reviewers */ }
}
async function boot(user: User) { try { await establishSession(user); patchOnboardingFetch(); } catch { return; } const observer = new MutationObserver(() => document.querySelectorAll<HTMLFormElement>("form.auth-form").forEach(injectApplicantFields)); observer.observe(document.documentElement, { childList: true, subtree: true }); document.querySelectorAll<HTMLFormElement>("form.auth-form").forEach(injectApplicantFields); await renderApplicantStatus(); await renderReviewerQueue(); setInterval(() => { document.querySelectorAll<HTMLFormElement>("form.auth-form").forEach(injectApplicantFields); void renderApplicantStatus(); }, 2500); }
patchOnboardingFetch(); if (getApps().length) onAuthStateChanged(getAuth(getApp()), user => { if (user) void boot(user); });
