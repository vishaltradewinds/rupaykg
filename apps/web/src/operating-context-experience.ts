import { getOperatingContextConfig, readOperatingContext, type OperatingContext } from "./operating-context";

const PANEL_ID = "rupaykg-context-experience";

function render(context: OperatingContext = readOperatingContext()) {
  const config = getOperatingContextConfig(context);
  document.documentElement.dataset.rupaykgContext = context;
  document.title = `RupayKG · ${config.label}`;

  const shell = document.querySelector(".app-shell");
  if (!shell) return;

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "Operating context");
    panel.style.cssText = [
      "margin:12px 16px 0",
      "padding:14px 16px",
      "border:1px solid rgba(87,211,255,.18)",
      "border-radius:16px",
      "background:linear-gradient(135deg,rgba(7,17,31,.96),rgba(10,28,44,.88))",
      "box-shadow:0 10px 32px rgba(0,0,0,.18)",
      "color:#dbe7ef",
      "font:500 12px/1.45 system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
    ].join(";");
    shell.insertBefore(panel, shell.firstChild?.nextSibling ?? shell.firstChild);
  }

  panel.textContent = "";
  const heading = document.createElement("div");
  heading.textContent = `${config.label} operating model`;
  heading.style.cssText = "font-weight:700;font-size:13px;color:#e8f4fa;margin-bottom:4px";
  panel.appendChild(heading);

  const hierarchy = document.createElement("div");
  hierarchy.textContent = config.geography;
  hierarchy.style.opacity = ".9";
  panel.appendChild(hierarchy);

  const meta = document.createElement("div");
  meta.textContent = `${config.waste} · ${config.analytics} · Primary actor: ${config.actor}`;
  meta.style.cssText = "margin-top:4px;opacity:.78";
  panel.appendChild(meta);

  const focus = document.createElement("div");
  focus.textContent = `Field focus: ${config.fieldFocus}`;
  focus.style.cssText = "margin-top:4px;opacity:.78";
  panel.appendChild(focus);

  const categories = document.createElement("div");
  categories.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:9px";
  for (const category of config.categories) {
    const chip = document.createElement("span");
    chip.textContent = category;
    chip.style.cssText = "padding:4px 8px;border:1px solid rgba(87,211,255,.16);border-radius:999px;background:rgba(87,211,255,.05);font-size:10px;opacity:.9";
    categories.appendChild(chip);
  }
  panel.appendChild(categories);
}

function mount() {
  render();
  const observer = new MutationObserver(() => render());
  const shell = document.querySelector(".app-shell");
  if (shell) observer.observe(shell, { childList: true, subtree: true });
  window.addEventListener("rupaykg:operating-context-change", (event) => {
    const context = (event as CustomEvent<OperatingContext>).detail;
    render(context === "rural" ? "rural" : "urban");
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
