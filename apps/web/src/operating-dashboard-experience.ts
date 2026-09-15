import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const PANEL_ID = "rupaykg-operating-dashboard";

function mount(context: OperatingContext = readOperatingContext()): void {
  const config = getOperatingContextConfig(context);
  const shell = document.querySelector(".app-shell") ?? document.body;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "RupayKG operating dashboard");
    Object.assign(panel.style, { margin: "12px 16px", padding: "16px", border: "1px solid rgba(87,211,255,.18)", borderRadius: "16px", background: "rgba(7,17,31,.94)", color: "#dbe7ef", font: "500 12px/1.45 system-ui,sans-serif" });
    shell.appendChild(panel);
  }
  panel.textContent = "";
  const title = document.createElement("strong");
  title.textContent = `${config.label} operating dashboard`;
  Object.assign(title.style, { display: "block", fontSize: "17px", color: "#e8f4fa", marginBottom: "3px" });
  panel.appendChild(title);
  const subtitle = document.createElement("div");
  subtitle.textContent = `${config.anchor} · ${config.unit} · ${config.waste}`;
  Object.assign(subtitle.style, { opacity: ".78", marginBottom: "12px" });
  panel.appendChild(subtitle);

  const grid = document.createElement("div");
  Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "8px" });
  const cards: Array<[string, string]> = [
    ["Operating geography", config.geography],
    ["Primary actor", config.actor],
    ["Field focus", config.fieldFocus],
    ["Analytics", config.analytics],
  ];
  for (const [label, value] of cards) {
    const card = document.createElement("article");
    Object.assign(card.style, { padding: "10px", borderRadius: "11px", border: "1px solid rgba(87,211,255,.13)", background: "rgba(11,24,37,.75)" });
    const l = document.createElement("div"); l.textContent = label; Object.assign(l.style, { fontSize: "10px", textTransform: "uppercase", letterSpacing: ".06em", opacity: ".62", marginBottom: "4px" });
    const v = document.createElement("div"); v.textContent = value; Object.assign(v.style, { fontWeight: "700" });
    card.append(l, v); grid.appendChild(card);
  }
  panel.appendChild(grid);

  const flow = document.createElement("div");
  flow.textContent = "Capture → Measure → Evidence → Verify → Provenance → Registry → Value";
  Object.assign(flow.style, { marginTop: "12px", padding: "9px 10px", borderRadius: "10px", background: "rgba(45,140,255,.08)", border: "1px solid rgba(45,140,255,.16)", fontWeight: "700" });
  panel.appendChild(flow);

  const note = document.createElement("div");
  note.textContent = context === "rural" ? "Rural mode prioritizes village-level biomass capture and offline field operations." : "Urban mode prioritizes ward-level MSW capture, collection and material recovery flows.";
  Object.assign(note.style, { marginTop: "8px", opacity: ".72" });
  panel.appendChild(note);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mount(), { once: true }); else mount();
window.addEventListener("rupaykg:operating-context-change", event => mount((event as CustomEvent<OperatingContext>).detail === "rural" ? "rural" : "urban"));
