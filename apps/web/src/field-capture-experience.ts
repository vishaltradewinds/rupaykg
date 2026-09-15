import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const DRAFT_KEY = "rupaykg.fieldCaptureDrafts";
const PANEL_ID = "rupaykg-field-capture";

type Draft = {
  id: string;
  context: OperatingContext;
  activityType: string;
  material: string;
  quantity: string;
  unit: string;
  geography: string;
  notes: string;
  capturedAt: string;
  syncStatus: "LOCAL_DRAFT";
};

function drafts(): Draft[] {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]") as Draft[]; } catch { return []; }
}

function saveDraft(draft: Draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify([draft, ...drafts()].slice(0, 100)));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function render(context: OperatingContext = readOperatingContext()) {
  const config = getOperatingContextConfig(context);
  const shell = document.querySelector(".app-shell");
  if (!shell) return;

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = el("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "Field activity capture");
    panel.style.cssText = "margin:12px 16px;padding:16px;border:1px solid rgba(87,211,255,.18);border-radius:16px;background:rgba(7,17,31,.94);color:#dbe7ef;font:500 12px/1.45 system-ui,sans-serif;";
    shell.appendChild(panel);
  }

  panel.textContent = "";
  const heading = el("strong", `Field capture · ${config.label}`);
  heading.style.cssText = "display:block;font-size:15px;color:#e8f4fa;margin-bottom:3px";
  panel.appendChild(heading);
  panel.appendChild(el("div", config.fieldFocus));

  const form = el("form");
  form.style.cssText = "display:grid;gap:9px;margin-top:12px";
  const activity = el("select");
  ["GENERATION", "AGGREGATION", "MEASUREMENT", "TRANSPORT", "PROCESSING"].forEach(v => activity.appendChild(el("option", v)));
  const material = el("select");
  config.categories.forEach(v => material.appendChild(el("option", v)));
  const quantity = el("input"); quantity.type = "number"; quantity.min = "0"; quantity.step = "any"; quantity.placeholder = "Quantity"; quantity.required = true;
  const unit = el("select"); ["kg", "tonne", "litre", "unit"].forEach(v => unit.appendChild(el("option", v)));
  const geography = el("input"); geography.placeholder = context === "urban" ? "Ward / facility reference" : "Village / producer reference";
  const notes = el("textarea"); notes.placeholder = "Optional field notes"; notes.rows = 2;
  const save = el("button", "Save field draft"); save.type = "submit";
  save.style.cssText = "padding:10px 12px;border:0;border-radius:10px;background:#2d8cff;color:white;font-weight:700;cursor:pointer";
  const status = el("div", `${drafts().length} local draft(s) · Not yet submitted to the authoritative MRV ledger.`);
  status.style.cssText = "margin-top:7px;opacity:.75";

  [activity, material, quantity, unit, geography, notes].forEach(input => {
    input.style.cssText = "width:100%;box-sizing:border-box;padding:9px 10px;border-radius:9px;border:1px solid rgba(87,211,255,.18);background:#0b1825;color:#dbe7ef";
  });
  form.append(activity, material, quantity, unit, geography, notes, save, status);
  form.addEventListener("submit", event => {
    event.preventDefault();
    const draft: Draft = {
      id: crypto.randomUUID(), context, activityType: activity.value, material: material.value,
      quantity: quantity.value, unit: unit.value, geography: geography.value.trim(), notes: notes.value.trim(),
      capturedAt: new Date().toISOString(), syncStatus: "LOCAL_DRAFT",
    };
    saveDraft(draft);
    quantity.value = ""; geography.value = ""; notes.value = "";
    status.textContent = `${drafts().length} local draft(s) · Saved on this device. Authoritative sync requires an authenticated, verified field device.`;
  });
  panel.appendChild(form);
}

function mount() {
  render();
  window.addEventListener("rupaykg:operating-context-change", event => {
    const context = (event as CustomEvent<OperatingContext>).detail;
    render(context === "rural" ? "rural" : "urban");
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
