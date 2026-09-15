import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

function apply() {
  const context: OperatingContext = readOperatingContext();
  const c = getOperatingContextConfig(context);
  document.documentElement.dataset.rupaykgContext = context;
  document.documentElement.dataset.rupaykgGeography = c.unit.toLowerCase();

  const host = document.getElementById("rupaykg-operating-context") ?? document.body;
  let lens = document.getElementById("rupaykg-context-lens");
  if (!lens) {
    lens = document.createElement("aside");
    lens.id = "rupaykg-context-lens";
    Object.assign(lens.style, {
      position: "fixed", top: "62px", right: "14px", zIndex: "999", maxWidth: "300px",
      padding: "10px 12px", border: "1px solid rgba(87,211,255,.22)", borderRadius: "12px",
      background: "rgba(7,17,31,.90)", color: "#b8c9d6", font: "500 11px/1.45 system-ui,sans-serif",
      boxShadow: "0 8px 28px rgba(0,0,0,.24)",
    });
    host.appendChild(lens);
  }
  lens.textContent = "";
  const title = document.createElement("strong");
  title.textContent = `${c.label} operating lens`;
  Object.assign(title.style, { display: "block", color: "#e8f4fa", marginBottom: "3px" });
  lens.appendChild(title);
  const hierarchy = document.createElement("span");
  hierarchy.textContent = c.geography;
  lens.appendChild(hierarchy);
  const actor = document.createElement("span");
  actor.textContent = `Primary actor: ${c.actor}`;
  Object.assign(actor.style, { display: "block", marginTop: "3px", opacity: ".8" });
  lens.appendChild(actor);
  const focus = document.createElement("span");
  focus.textContent = c.fieldFocus;
  Object.assign(focus.style, { display: "block", marginTop: "3px", opacity: ".8" });
  lens.appendChild(focus);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
else apply();
window.addEventListener("rupaykg:operating-context-change", apply);
