const KEY = "rupaykg.operatingContext";
type Context = "urban" | "rural";
const copy = {
  urban: { anchor: "Municipal Corporation", unit: "Ward", waste: "MSW", analytics: "Ward Analytics", actor: "Citizen / MSW Generator" },
  rural: { anchor: "Gram Panchayat", unit: "Village", waste: "Biomass", analytics: "Village Analytics", actor: "Farmer / FPO / Biomass Generator" },
} as const;

function context(): Context {
  return window.localStorage.getItem(KEY) === "rural" ? "rural" : "urban";
}

function apply() {
  const c = copy[context()];
  document.documentElement.dataset.rupaykgContext = context();
  const host = document.getElementById("rupaykg-operating-context") ?? document.body;
  let lens = document.getElementById("rupaykg-context-lens");
  if (!lens) {
    lens = document.createElement("aside");
    lens.id = "rupaykg-context-lens";
    Object.assign(lens.style, { position:"fixed", top:"62px", right:"14px", zIndex:"999", maxWidth:"260px", padding:"10px 12px", border:"1px solid rgba(87,211,255,.22)", borderRadius:"12px", background:"rgba(7,17,31,.90)", color:"#b8c9d6", font:"500 11px/1.45 system-ui,sans-serif", boxShadow:"0 8px 28px rgba(0,0,0,.24)" });
    host.appendChild(lens);
  }
  lens.innerHTML = `<strong style="display:block;color:#e8f4fa;margin-bottom:3px">${context()==="urban"?"Urban operating lens":"Rural operating lens"}</strong><span>${c.anchor} → ${c.unit} · ${c.waste} · ${c.analytics}</span><span style="display:block;margin-top:3px;opacity:.8">Primary actor: ${c.actor}</span>`;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once:true }); else apply();
window.addEventListener("rupaykg:operating-context-change", apply);
