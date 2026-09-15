import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const PANEL_ID = "rupaykg-operating-workflow";

type Step = { title: string; detail: string; target: string };

const workflows: Record<OperatingContext, Step[]> = {
  urban: [
    { title: "1 · Capture", detail: "Record ward-level MSW activity from an authorized field device.", target: "rupaykg-field-capture" },
    { title: "2 · Measure", detail: "Capture quantity and measurement evidence for the activity.", target: "resource-flow-intake" },
    { title: "3 · Evidence", detail: "Attach and review evidence before verification.", target: "mrv-provenance" },
    { title: "4 · Verify", detail: "Apply the existing controlled verification workflow.", target: "mrv-verification-actions" },
    { title: "5 · Value", detail: "Move eligible verified outcomes through registry and settlement controls.", target: "value-lifecycle-management" },
  ],
  rural: [
    { title: "1 · Capture", detail: "Record village-level biomass activity from an authorized field device, including offline capture.", target: "rupaykg-field-capture" },
    { title: "2 · Aggregate", detail: "Record aggregation from farmer/FPO/biomass sources without bypassing geography authorization.", target: "resource-flow-intake" },
    { title: "3 · Measure", detail: "Capture quantity and measurement evidence for the biomass flow.", target: "resource-flow-intake" },
    { title: "4 · Verify", detail: "Review evidence and apply the existing controlled MRV verification workflow.", target: "mrv-verification-actions" },
    { title: "5 · Value", detail: "Move eligible verified outcomes through provenance, registry and settlement controls.", target: "value-lifecycle-management" },
  ],
};

function scrollToTarget(target: string): void {
  const node = document.getElementById(target);
  if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
}

function render(context: OperatingContext = readOperatingContext()): void {
  const config = getOperatingContextConfig(context);
  const steps = workflows[context];
  const shell = document.querySelector(".app-shell") ?? document.body;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", `${config.label} operating workflow`);
    Object.assign(panel.style, { margin: "12px 16px", padding: "16px", border: "1px solid rgba(87,211,255,.18)", borderRadius: "16px", background: "rgba(7,17,31,.94)", color: "#dbe7ef", font: "500 12px/1.45 system-ui,sans-serif" });
    shell.appendChild(panel);
  }
  panel.textContent = "";
  const heading = document.createElement("strong");
  heading.textContent = `${config.label} operating workflow`;
  Object.assign(heading.style, { display: "block", fontSize: "16px", color: "#e8f4fa", marginBottom: "3px" });
  panel.appendChild(heading);
  const subtitle = document.createElement("div");
  subtitle.textContent = `${config.anchor} · ${config.unit} · ${config.waste} · one common authoritative MRV/value engine`;
  Object.assign(subtitle.style, { opacity: ".76", marginBottom: "12px" });
  panel.appendChild(subtitle);

  const grid = document.createElement("div");
  Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "8px" });
  steps.forEach((step, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `${step.title}: ${step.detail}`);
    Object.assign(button.style, { textAlign: "left", padding: "11px", borderRadius: "11px", border: "1px solid rgba(87,211,255,.14)", background: "rgba(11,24,37,.78)", color: "#dbe7ef", cursor: "pointer" });
    const title = document.createElement("div"); title.textContent = step.title; Object.assign(title.style, { fontWeight: "700", marginBottom: "4px" });
    const detail = document.createElement("div"); detail.textContent = step.detail; Object.assign(detail.style, { opacity: ".72", fontSize: "11px" });
    button.append(title, detail);
    button.addEventListener("click", () => scrollToTarget(step.target));
    grid.appendChild(button);
    if (index < steps.length - 1) {
      // The cards themselves are the workflow; no client-side mutation is performed here.
    }
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
  window.addEventListener("rupaykg:operating-context-change", event => {
    render((event as CustomEvent<OperatingContext>).detail === "rural" ? "rural" : "urban");
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
