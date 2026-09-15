import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const PANEL_ID = "rupaykg-operating-workflow";

type Step = { title: string; detail: string; target: string };

const common = (capture: string, second: string): Step[] => [
  { title: "1 · Capture", detail: capture, target: "rupaykg-field-capture" },
  { title: "2 · " + second, detail: "Create the authoritative activity/resource record within the authorized organization and geography.", target: "resource-flow-intake" },
  { title: "3 · Measure", detail: "Record a positive quantity with method, source and timestamp; measurements remain bound to the activity.", target: "resource-flow-intake" },
  { title: "4 · Evidence", detail: "Attach evidence with a content hash or authoritative content URI and keep it bound to the activity/measurement.", target: "mrv-provenance" },
  { title: "5 · Verify", detail: "Use the controlled verification workflow; approval is distinct from Guardian MRV and ledger consensus.", target: "mrv-verification-actions" },
  { title: "6 · MRV", detail: "Guardian MRV can proceed only after completed activity, approved verification and VERIFIED evidence.", target: "mrv-provenance" },
  { title: "7 · Provenance", detail: "Persist Guardian execution and Hedera HCS consensus evidence; local state is never presented as consensus.", target: "mrv-provenance" },
  { title: "8 · Value", detail: "Only eligible, verified and provenance-backed outcomes may enter registry/value controls.", target: "value-lifecycle-management" },
  { title: "9 · Settlement", detail: "Settlement remains permissioned and requires external authority confirmation before final settlement.", target: "settlement-reconciliation-control" },
];

const workflows: Record<OperatingContext, Step[]> = {
  urban: common("Record ward-level MSW activity from an authorized field device.", "Create Activity"),
  rural: common("Record village-level biomass activity from an authorized field device, including offline capture.", "Aggregate"),
};

function scrollToTarget(target: string): void {
  document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function render(context: OperatingContext = readOperatingContext()): void {
  const config = getOperatingContextConfig(context);
  const shell = document.querySelector(".app-shell") ?? document.body;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", `${config.label} golden operating path`);
    Object.assign(panel.style, { margin: "12px 16px", padding: "16px", border: "1px solid rgba(87,211,255,.18)", borderRadius: "16px", background: "rgba(7,17,31,.94)", color: "#dbe7ef", font: "500 12px/1.45 system-ui,sans-serif" });
    shell.appendChild(panel);
  }
  panel.textContent = "";
  const heading = document.createElement("strong");
  heading.textContent = `${config.label} golden operating path`;
  Object.assign(heading.style, { display: "block", fontSize: "16px", color: "#e8f4fa", marginBottom: "3px" });
  panel.appendChild(heading);
  const subtitle = document.createElement("div");
  subtitle.textContent = `${config.anchor} · ${config.unit} · ${config.waste} · ${config.geography}`;
  Object.assign(subtitle.style, { opacity: ".76", marginBottom: "5px" });
  panel.appendChild(subtitle);
  const note = document.createElement("div");
  note.textContent = "Trust rule: Pending is not Verified; Verified is not HCS consensus; HCS consensus is not settlement. Every transition must be supported by the authoritative backend.";
  Object.assign(note.style, { marginBottom: "12px", padding: "9px 10px", borderRadius: "10px", background: "rgba(45,140,255,.08)", border: "1px solid rgba(45,140,255,.16)", opacity: ".88" });
  panel.appendChild(note);

  const grid = document.createElement("div");
  Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "8px" });
  workflows[context].forEach((step) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `${step.title}: ${step.detail}`);
    Object.assign(button.style, { textAlign: "left", padding: "11px", borderRadius: "11px", border: "1px solid rgba(87,211,255,.14)", background: "rgba(11,24,37,.78)", color: "#dbe7ef", cursor: "pointer" });
    const title = document.createElement("div"); title.textContent = step.title; Object.assign(title.style, { fontWeight: "700", marginBottom: "4px" });
    const detail = document.createElement("div"); detail.textContent = step.detail; Object.assign(detail.style, { opacity: ".72", fontSize: "11px" });
    button.append(title, detail);
    button.addEventListener("click", () => scrollToTarget(step.target));
    grid.appendChild(button);
  });
  panel.appendChild(grid);

  const guard = document.createElement("div");
  guard.textContent = context === "rural"
    ? "Rural guardrail: village/producer operations remain organization- and geography-authorized; offline drafts are not authoritative until accepted by the existing sync pipeline."
    : "Urban guardrail: ward/facility operations remain organization- and geography-authorized; field capture does not bypass the existing MRV controls.";
  Object.assign(guard.style, { marginTop: "10px", padding: "9px 10px", borderRadius: "10px", background: "rgba(45,140,255,.08)", border: "1px solid rgba(45,140,255,.16)", opacity: ".82" });
  panel.appendChild(guard);
}

function mount(): void {
  render();
  window.addEventListener("rupaykg:operating-context-change", event => render((event as CustomEvent<OperatingContext>).detail === "rural" ? "rural" : "urban"));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
