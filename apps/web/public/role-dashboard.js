(() => {
  "use strict";

  const roleConfig = {
    citizen: { title: "Community activity", subtitle: "Record and follow verified local resource activity." },
    farmer: { title: "Rural resource activity", subtitle: "Capture authorised activity, evidence and verified outcomes for your geography." },
    safai_mitra: { title: "Field collection", subtitle: "Capture field activity and evidence only within your authorised geography." },
    fpo: { title: "Rural enterprise", subtitle: "Track resource flows, verified activity and applicable value workflows." },
    municipal_admin: { title: "ULB operations", subtitle: "Monitor authorised resource flows, MRV, compliance and governance records." },
    municipal_generator: { title: "Municipal / bulk generator", subtitle: "Manage authoritative SWM, EPR and ESG records without implying external submission or acceptance." },
    aggregator: { title: "Aggregation & transport", subtitle: "Track authorised collection, movement, evidence and downstream processing records." },
    processor: { title: "Processing & recycling", subtitle: "Track processing evidence and MRV verification within your authorised operating scope." },
    industry_generator: { title: "Industrial generator", subtitle: "Operate verified resource, compliance, EPR/ESG, carbon and reporting workflows." },
    commercial_generator: { title: "Commercial generator", subtitle: "Operate verified waste, BWG, EPR and ESG reporting workflows where applicable." },
    institution_generator: { title: "Institutional generator", subtitle: "Maintain authoritative waste, BWG, compliance and ESG records." },
    PROJECT_OWNER: { title: "Environmental project", subtitle: "Move verified activity through methodology and registry controls; settlement remains separately permission-gated." },
    ACVA_USER: { title: "Verification workspace", subtitle: "Review authoritative evidence and verification state without bypassing server controls." },
    ccc_buyer: { title: "Carbon / ESG buyer", subtitle: "Review verified environmental value, registry state, settlement and ESG records." },
    epr_partner: { title: "EPR operations", subtitle: "Review applicable obligations, verified evidence and EPR/ESG reporting state." },
    csr_partner: { title: "ESG / CSR operations", subtitle: "Review authoritative environmental outcomes and reporting evidence." },
    regulator: { title: "Regulatory oversight", subtitle: "Inspect authorised records, provenance and governance state. High-risk mutations remain server-gated." },
    platform_admin: { title: "Platform governance", subtitle: "Review onboarding, authorised operational records, compliance and reporting state without bypassing server-side controls." },
    super_admin: { title: "Platform governance", subtitle: "Review authorised platform lifecycle, value, registry, settlement and reporting state; server-side permissions remain authoritative." }
  };

  const operationalPanelIds = [
    "field-device-management", "resource-flow-intake", "citizen-farmer-guided",
    "mrv-provenance", "mrv-verification-actions", "compliance-assessment",
    "epr-return-lifecycle", "statutory-applicability", "bwg-reporting", "esg-metrics",
    "registry-issuance", "registry-settlement", "settlement-reconciliation-control",
    "value-lifecycle-management"
  ];

  const concealOperationalPanels = () => {
    operationalPanelIds.forEach(id => {
      const node = document.getElementById(id);
      if (!node) return;
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
      node.style.setProperty("display", "none", "important");
    });
    const console = document.getElementById("operational-console");
    if (console) {
      console.hidden = true;
      console.setAttribute("aria-hidden", "true");
      console.style.setProperty("display", "none", "important");
    }
  };

  const roleFromIdentity = () => {
    const text = document.querySelector(".identity-bar span")?.textContent || "";
    const match = text.match(/^(.+?)\s·/);
    if (!match) return "";
    const known = { "Citizen / household": "citizen", "Farmer / rural producer": "farmer", "Waste collection worker": "safai_mitra", "FPO / rural enterprise": "fpo", "ULB / municipal authority": "municipal_admin", "Municipal / bulk generator": "municipal_generator", "Collector / aggregator / transporter": "aggregator", "MRF / recycler / processor": "processor", "Industrial generator": "industry_generator", "Commercial generator": "commercial_generator", "Institutional generator": "institution_generator", "Carbon project owner": "PROJECT_OWNER", "MRV / assurance user": "ACVA_USER", "Carbon / ESG buyer": "ccc_buyer", "EPR partner": "epr_partner", "CSR / ESG partner": "csr_partner", "Regulator / public authority": "regulator", "Platform administrator": "platform_admin", "Platform super administrator": "super_admin" };
    return known[match[1].trim()] || "";
  };

  function backendWorkspaces(tabs) {
    return Array.from(tabs.querySelectorAll("button")).filter(button => !button.hidden).map(button => button.textContent?.trim() || "").filter(Boolean);
  }

  function mountOperationalConsole() {
    if (document.getElementById("operational-console")) return;
    const anchor = document.querySelector(".workspace-panel");
    if (!anchor) return;
    const section = document.createElement("section");
    section.id = "operational-console";
    section.className = "operational-console lifecycle-operations";
    section.setAttribute("aria-label", "Authoritative operational controls");
    section.innerHTML = '<div class="section-heading"><div><p class="eyebrow">AUTHORITATIVE OPERATIONS</p><h2>Execute governed lifecycle actions</h2></div><span>Existing operational panels use the same authenticated API and server-side permissions</span></div><p class="field-help">Controls below are projections of existing backend workflows. Availability follows the authorized workspace returned by the application; the server remains authoritative for every mutation.</p>';
    const grid = document.createElement("div");
    grid.className = "operational-panels";
    operationalPanelIds.forEach(id => { const node = document.getElementById(id); if (node) grid.appendChild(node); });
    section.appendChild(grid);
    anchor.insertAdjacentElement("afterend", section);
  }

  function scopeOperationalPanels(workspaces) {
    const panelWorkspaces = {
      "field-device-management": ["Operations"],
      "resource-flow-intake": ["Operations"],
      "citizen-farmer-guided": ["Operations", "MRV & Evidence"],
      "mrv-provenance": ["MRV & Evidence"],
      "mrv-verification-actions": ["MRV & Evidence"],
      "compliance-assessment": ["Compliance & EPR"],
      "epr-return-lifecycle": ["Compliance & EPR"],
      "statutory-applicability": ["Compliance & EPR"],
      "bwg-reporting": ["Compliance & EPR", "ESG / BRSR"],
      "esg-metrics": ["ESG / BRSR"],
      "registry-issuance": ["Registry"],
      "registry-settlement": ["Registry", "Settlement"],
      "settlement-reconciliation-control": ["Settlement"],
      "value-lifecycle-management": ["Carbon & Value", "Registry", "Settlement"]
    };
    Object.entries(panelWorkspaces).forEach(([id, allowed]) => {
      const node = document.getElementById(id);
      if (!node) return;
      const visible = allowed.some(workspace => workspaces.includes(workspace));
      node.hidden = !visible;
      node.setAttribute("aria-hidden", visible ? "false" : "true");
      node.style.setProperty("display", visible ? "" : "none", "important");
    });
  }

  function mountAccessibilityControls() {
    if (document.getElementById("rupaykg-accessibility-controls")) return;
    const panel = document.createElement("section");
    panel.id = "rupaykg-accessibility-controls";
    panel.setAttribute("aria-label", "Accessibility and assistance");
    Object.assign(panel.style, { position: "fixed", left: "12px", bottom: "12px", zIndex: "30", display: "flex", flexWrap: "wrap", gap: "6px", maxWidth: "calc(100vw - 24px)", padding: "8px", border: "1px solid #31516b", borderRadius: "14px", background: "rgba(7,17,31,.96)", boxShadow: "0 12px 36px rgba(0,0,0,.32)" });
    const makeButton = (label, title, handler) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.title = title; b.setAttribute("aria-label", title); b.className = "secondary"; b.addEventListener("click", handler); return b; };
    let fontScale = Number(localStorage.getItem("rupaykg.fontScale") || "1");
    const applyScale = () => { document.documentElement.style.setProperty("--rupaykg-font-scale", String(fontScale)); document.body.style.fontSize = `${fontScale}em`; localStorage.setItem("rupaykg.fontScale", String(fontScale)); };
    const speak = () => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const text = document.querySelector("main")?.innerText || document.body.innerText; const utterance = new SpeechSynthesisUtterance(text.slice(0, 5000)); utterance.lang = document.documentElement.lang || "en-IN"; window.speechSynthesis.speak(utterance); };
    const stop = () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
    const listen = () => { const browserWindow = window; const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition; if (!Recognition) { alert("Voice input is not available on this device/browser."); return; } const recognition = new Recognition(); recognition.lang = document.documentElement.lang || "en-IN"; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onresult = (event) => { const transcript = event.results?.[0]?.[0]?.transcript || ""; const active = document.activeElement; if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) { const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(active), "value")?.set; setter?.call(active, `${active.value ? `${active.value} ` : ""}${transcript}`); active.dispatchEvent(new Event("input", { bubbles: true })); } }; recognition.start(); };
    panel.append(makeButton("A+", "Increase text size", () => { fontScale = Math.min(1.35, +(fontScale + 0.1).toFixed(2)); applyScale(); }), makeButton("A−", "Decrease text size", () => { fontScale = Math.max(0.9, +(fontScale - 0.1).toFixed(2)); applyScale(); }), makeButton("◐", "High contrast", () => { document.documentElement.classList.toggle("rupaykg-high-contrast"); localStorage.setItem("rupaykg.highContrast", document.documentElement.classList.contains("rupaykg-high-contrast") ? "1" : "0"); }), makeButton("🔊", "Read page aloud", speak), makeButton("■", "Stop reading", stop), makeButton("🎤", "Enter text by voice", listen));
    document.body.appendChild(panel);
    applyScale();
    if (localStorage.getItem("rupaykg.highContrast") === "1") document.documentElement.classList.add("rupaykg-high-contrast");
    const style = document.createElement("style"); style.textContent = ".rupaykg-high-contrast body{background:#000!important;color:#fff!important}.rupaykg-high-contrast button,.rupaykg-high-contrast input,.rupaykg-high-contrast select,.rupaykg-high-contrast textarea{border-color:#fff!important;color:#fff!important;background:#111!important}.rupaykg-high-contrast a{color:#7dd3fc!important}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #facc15!important;outline-offset:2px}"; document.head.appendChild(style);
  }

  function render() {
    const identity = document.querySelector(".identity-bar");
    const metrics = document.querySelector(".metrics");
    const tabs = document.querySelector(".workspace-tabs");
    if (!identity || !metrics || !tabs) { concealOperationalPanels(); return; }
    const config = roleConfig[roleFromIdentity()];
    if (!config) { concealOperationalPanels(); return; }
    const workspaces = backendWorkspaces(tabs);
    if (!workspaces.length) { concealOperationalPanels(); return; }
    mountOperationalConsole();
    scopeOperationalPanels(workspaces);
    mountAccessibilityControls();
    let panel = document.getElementById("role-command-center");
    if (!panel) { panel = document.createElement("section"); panel.id = "role-command-center"; panel.className = "role-command-center"; metrics.parentNode?.insertBefore(panel, metrics); }
    panel.innerHTML = "";
    Object.assign(panel.style, { display: "grid", gridTemplateColumns: window.matchMedia("(max-width: 720px)").matches ? "minmax(0,1fr)" : "minmax(0,1fr) auto", gap: "18px", alignItems: "center", margin: "0 0 22px", padding: "18px 20px", border: "1px solid #28435c", borderRadius: "16px", background: "linear-gradient(135deg,rgba(15,34,52,.95),rgba(10,27,43,.82))" });
    const copy = document.createElement("div"); const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow"; eyebrow.textContent = "STAKEHOLDER COMMAND CENTER"; const title = document.createElement("h2"); title.textContent = config.title; const subtitle = document.createElement("p"); subtitle.textContent = config.subtitle; subtitle.style.cssText = "margin:7px 0 0;color:#7890a5;font-size:11px;line-height:1.5"; copy.append(eyebrow, title, subtitle);
    const actions = document.createElement("div"); actions.style.cssText = "display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end"; workspaces.forEach(name => { const target = Array.from(document.querySelectorAll(".workspace-tabs button")).find(button => button.textContent?.trim() === name && !button.hidden); const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = name; if (target) button.addEventListener("click", () => target.click()); else button.disabled = true; actions.appendChild(button); }); panel.append(copy, actions);
    const console = document.getElementById("operational-console"); if (console) { console.hidden = false; console.setAttribute("aria-hidden", "false"); console.style.setProperty("display", "", "important"); }
  }

  concealOperationalPanels();
  let scheduled = false;
  const schedule = () => { concealOperationalPanels(); if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; render(); }); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", schedule);
  window.addEventListener("resize", schedule);
  schedule();
})();