import { getApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";

const rootId = "rupaykg-onboarding-governance";
const storageKey = "rupaykg.activeOrganizationId";
let sessionToken = "";

type Application = {
  id: string;
  organization_name?: string;
  applicant_email?: string;
  requested_role_key?: string;
  geography_name?: string;
  legal_name?: string;
  legal_form?: string;
  registration_identifier?: string;
  evidence_count?: number;
  verification_status?: string;
  nextApproval?: { approval_level?: string; status?: string };
};

const guidance: Record<string, string[]> = {
  citizen: ["Confirm identity and operating area", "Complete local participation review", "Use Operations after approval"],
  farmer: ["Confirm producer identity and geography", "Complete authorized rural review", "Use Operations and MRV after approval"],
  safai_mitra: ["Confirm worker identity and area", "Complete authorized local review", "Use field operations after approval"],
  fpo: ["Confirm organization identity", "Complete local, district and state review as applicable", "Use Operations and MRV after approval"],
  municipal_admin: ["Confirm municipal authority and geography", "Complete authorized governance review", "Use institutional Operations, Compliance and MRV after approval"],
  municipal_generator: ["Confirm facility and organization", "Complete applicable hierarchy review", "Use Operations and Compliance after approval"],
  aggregator: ["Confirm operating organization and geography", "Complete hierarchy approval", "Use Operations and MRV after approval"],
  processor: ["Confirm facility and legal identity", "Complete hierarchy and legal verification", "Use Operations, MRV and Compliance after approval"],
  industry_generator: ["Confirm legal entity and facility", "Complete hierarchy and legal verification", "Use Operations, Compliance and ESG after approval"],
  commercial_generator: ["Confirm organization and operating site", "Complete applicable hierarchy approval", "Use Operations and Compliance after approval"],
  institution_generator: ["Confirm institution and operating site", "Complete applicable hierarchy approval", "Use Operations and Compliance after approval"],
  PROJECT_OWNER: ["Confirm project organization and geography", "Complete hierarchy and legal verification", "Use MRV and Carbon after approval"],
  ACVA_USER: ["Confirm assurance organization and scope", "Complete hierarchy and legal verification", "Use MRV after approval"],
  ccc_buyer: ["Confirm buyer organization and legal identity", "Complete hierarchy and legal verification", "Use Carbon, Registry and ESG after approval"],
  epr_partner: ["Confirm producer, brand or importer identity", "Complete hierarchy and legal verification", "Use Compliance and EPR after approval"],
  csr_partner: ["Confirm organization and legal identity", "Complete hierarchy and legal verification", "Use ESG and BRSR after approval"],
  regulator: ["Confirm authority identity and jurisdiction", "Complete authorized governance review", "Use read-only oversight after approval"]
};

function getRoot(): HTMLElement {
  let el = document.getElementById(rootId);
  if (!el) {
    el = document.createElement("section");
    el.id = rootId;
    document.body.appendChild(el);
  }
  return el;
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
  const org = localStorage.getItem(storageKey);
  if (org) headers.set("X-RupayKG-Organization-Id", org);
  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

async function establishSession(user: User) {
  const response = await fetch("/api/v1/auth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ idToken: await user.getIdToken(true) })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "Unable to establish RupayKG session");
  sessionToken = body.sessionToken || "";
  const memberships = Array.isArray(body.memberships) ? body.memberships : [];
  const verified = memberships.find((m: any) => m && m.status === "VERIFIED" && m.organization_id);
  if (!localStorage.getItem(storageKey) && verified) localStorage.setItem(storageKey, verified.organization_id);
}

function renderApplicant(target: Element, application: Application) {
  const old = document.getElementById("rupaykg-onboarding-status");
  if (old) old.remove();
  const box = document.createElement("section");
  box.id = "rupaykg-onboarding-status";
  box.style.cssText = "margin:10px 0;padding:12px;border:1px solid #314c63;border-radius:12px";
  const title = document.createElement("strong");
  title.textContent = `Onboarding · ${application.requested_role_key || "Stakeholder"}`;
  box.appendChild(title);
  const status = document.createElement("p");
  status.textContent = `Status: ${application.nextApproval?.status || "PENDING"}. Access remains blocked until the required authority chain is complete.`;
  status.style.cssText = "font-size:12px;line-height:1.45;opacity:.8";
  box.appendChild(status);
  const steps = guidance[application.requested_role_key || ""] || ["Confirm identity and geography", "Complete the server-authorized approval chain", "Use role-specific workspaces after approval"];
  steps.forEach((text, index) => {
    const row = document.createElement("div");
    row.textContent = `${index + 1}. ${text}`;
    row.style.cssText = "font-size:12px;margin-top:5px";
    box.appendChild(row);
  });
  target.prepend(box);
}

async function applicantStatus() {
  if (!sessionToken) return;
  try {
    const me = await api("/api/v1/auth/me");
    const applications: Application[] = Array.isArray(me.applications) ? me.applications : [];
    const pending = applications.find((a) => a.status === "PENDING") || applications[0];
    const target = document.querySelector(".onboarding-card");
    if (target && pending) renderApplicant(target, pending);
  } catch {
    // Do not manufacture status when the authoritative endpoint is unavailable.
  }
}

async function reviewerQueue() {
  if (!sessionToken) return;
  try {
    const result = await api("/api/v1/onboarding/review-queue");
    const applications: Application[] = Array.isArray(result.applications) ? result.applications : [];
    const panel = getRoot();
    panel.replaceChildren();
    panel.style.cssText = "max-width:980px;margin:18px auto;padding:0 16px";
    const title = document.createElement("strong");
    title.textContent = "Stakeholder approval queue";
    panel.appendChild(title);
    const note = document.createElement("p");
    note.textContent = "Reviewer eligibility and the current approval step are determined by the server from authority role, membership and geography.";
    note.style.cssText = "font-size:12px;opacity:.72";
    panel.appendChild(note);
    if (!applications.length) {
      const empty = document.createElement("div");
      empty.textContent = "No applications are awaiting action in this authority scope.";
      empty.style.cssText = "padding:12px;border:1px solid #314c63;border-radius:12px;font-size:12px";
      panel.appendChild(empty);
      return;
    }
    applications.forEach((application) => {
      const card = document.createElement("article");
      card.style.cssText = "margin-top:10px;padding:12px;border:1px solid #314c63;border-radius:12px";
      const name = document.createElement("strong");
      name.textContent = application.organization_name || "Organization";
      card.appendChild(name);
      const meta = document.createElement("div");
      meta.textContent = `${application.requested_role_key || "Role"} · ${application.applicant_email || ""} · ${application.geography_name || "No geography"}`;
      meta.style.cssText = "font-size:12px;opacity:.78;margin-top:4px";
      card.appendChild(meta);
      const step = document.createElement("div");
      const approval = application.nextApproval;
      step.textContent = approval ? `Current step: ${approval.approval_level || "AUTHORITY"} · ${approval.status || "PENDING"}` : "Current step: unavailable";
      step.style.cssText = "font-size:12px;margin-top:6px";
      card.appendChild(step);
      const legal = document.createElement("div");
      legal.textContent = `Legal: ${application.legal_name || "—"} · ${application.legal_form || "—"} · ${application.registration_identifier || "—"} · Evidence: ${application.evidence_count ?? 0} · Status: ${application.verification_status || "PENDING"}`;
      legal.style.cssText = "font-size:12px;margin-top:6px";
      card.appendChild(legal);
      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px";
      const rationale = document.createElement("input");
      rationale.placeholder = "Review rationale";
      rationale.style.minWidth = "260px";
      controls.appendChild(rationale);
      ["approve", "reject"].forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = action === "approve" ? "Approve current step" : "Reject application";
        button.onclick = async () => {
          if (action === "reject" && !rationale.value.trim()) {
            alert("A review rationale is required.");
            return;
          }
          button.disabled = true;
          try {
            await api(`/api/v1/onboarding/applications/${application.id}/${action}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reviewNote: rationale.value.trim() || undefined })
            });
            await reviewerQueue();
          } catch (error) {
            alert(error instanceof Error ? error.message : "Approval action failed");
            button.disabled = false;
          }
        };
        controls.appendChild(button);
      });
      card.appendChild(controls);
      panel.appendChild(card);
    });
  } catch {
    // Non-authorized users receive no reviewer surface.
  }
}

async function boot(user: User) {
  try {
    await establishSession(user);
  } catch {
    return;
  }
  const observer = new MutationObserver(() => {
    document.querySelectorAll<HTMLFormElement>("form.auth-form").forEach((form) => {
      if (form.querySelector("[data-rupaykg-governance-fields]")) return;
      const box = document.createElement("fieldset");
      box.dataset.rupaykgGovernanceFields = "true";
      box.style.cssText = "margin:8px 0;padding:12px;border:1px solid #314c63;border-radius:12px";
      const legend = document.createElement("legend");
      legend.textContent = "Legal identity & verification evidence";
      box.appendChild(legend);
      [
        ["Legal name", "legalName", "Registered legal name"],
        ["Legal form", "legalForm", "Company / LLP / Trust / ULB / etc."],
        ["Registration identifier", "registrationIdentifier", "CIN / registration number / applicable identifier"],
        ["Registration authority", "registrationAuthority", "MCA / Registrar / ULB / competent authority"],
        ["Evidence type", "evidenceType", "Incorporation / registration / authorization"],
        ["Document reference", "documentReference", "Controlled document reference"],
        ["Evidence content hash", "contentHash", "SHA-256 or controlled content hash"]
      ].forEach(([label, name, placeholder]) => {
        const field = document.createElement("label");
        field.style.cssText = "display:block;margin:7px 0;font-size:12px";
        field.textContent = label;
        const input = document.createElement("input");
        input.name = name;
        input.placeholder = placeholder;
        input.required = true;
        input.style.cssText = "display:block;width:100%;margin-top:4px";
        field.appendChild(input);
        box.appendChild(field);
      });
      form.appendChild(box);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  await applicantStatus();
  await reviewerQueue();
}

if (getApps().length) {
  onAuthStateChanged(getAuth(getApp()), (user) => {
    if (user) void boot(user);
  });
}
