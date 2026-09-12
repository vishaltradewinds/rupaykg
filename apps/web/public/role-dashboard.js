(() => {
  "use strict";

  const roleConfig = {
    citizen: { title: "Community activity", subtitle: "Record and follow verified local resource activity.", workspaces: ["Operations", "MRV & Evidence"] },
    farmer: { title: "Rural resource activity", subtitle: "Capture authorised activity, evidence and verified outcomes for your geography.", workspaces: ["Operations", "MRV & Evidence", "Carbon & Value"] },
    safai_mitra: { title: "Field collection", subtitle: "Capture field activity and evidence only within your authorised geography.", workspaces: ["Operations", "MRV & Evidence"] },
    fpo: { title: "Rural enterprise", subtitle: "Track resource flows, verified activity and applicable value workflows.", workspaces: ["Operations", "MRV & Evidence", "Carbon & Value", "Compliance & EPR", "ESG / BRSR"] },
    municipal_admin: { title: "ULB operations", subtitle: "Monitor authorised resource flows, MRV, compliance and governance records.", workspaces: ["Operations", "MRV & Evidence", "Compliance & EPR", "ESG / BRSR"] },
    municipal_generator: { title: "Municipal / bulk generator", subtitle: "Manage authoritative SWM, EPR and ESG records without implying external submission or acceptance.", workspaces: ["Operations", "MRV & Evidence", "Compliance & EPR", "ESG / BRSR"] },
    aggregator: { title: "Aggregation & transport", subtitle: "Track authorised collection, movement, evidence and downstream processing records.", workspaces: ["Operations", "MRV & Evidence"] },
    processor: { title: "Processing & recycling", subtitle: "Track processing evidence and MRV verification within your authorised operating scope.", workspaces: ["Operations", "MRV & Evidence", "Compliance & EPR"] },
    industry_generator: { title: "Industrial generator", subtitle: "Operate verified resource, compliance, EPR/ESG, carbon and reporting workflows.", workspaces: ["Operations", "MRV & Evidence", "Compliance & EPR", "Carbon & Value", "ESG / BRSR"] },
    commercial_generator: { title: "Commercial generator", subtitle: "Operate verified waste, BWG, EPR and ESG reporting workflows where applicable.", workspaces: ["Operations", "Compliance & EPR", "ESG / BRSR", "MRV & Evidence"] },
    institution_generator: { title: "Institutional generator", subtitle: "Maintain authoritative waste, BWG, compliance and ESG records.", workspaces: ["Operations", "Compliance & EPR", "ESG / BRSR", "MRV & Evidence"] },
    PROJECT_OWNER: { title: "Environmental project", subtitle: "Move verified activity through methodology and registry controls; settlement remains separately permission-gated.", workspaces: ["MRV & Evidence", "Carbon & Value", "Registry"] },
    ACVA_USER: { title: "Verification workspace", subtitle: "Review authoritative evidence and verification state without bypassing server controls.", workspaces: ["MRV & Evidence", "Carbon & Value", "Registry"] },
    ccc_buyer: { title: "Carbon / ESG buyer", subtitle: "Review verified environmental value, registry state, settlement and ESG records.", workspaces: ["Carbon & Value", "Registry", "Settlement", "ESG / BRSR"] },
    epr_partner: { title: "EPR operations", subtitle: "Review applicable obligations, verified evidence and EPR/ESG reporting state.", workspaces: ["Compliance & EPR", "MRV & Evidence", "ESG / BRSR"] },
    csr_partner: { title: "ESG / CSR operations", subtitle: "Review authoritative environmental outcomes and reporting evidence.", workspaces: ["ESG / BRSR", "MRV & Evidence", "Carbon & Value", "Compliance & EPR"] },
    regulator: { title: "Regulatory oversight", subtitle: "Inspect authorised records, provenance and governance state. High-risk mutations remain server-gated.", workspaces: ["Compliance & EPR", "MRV & Evidence", "Registry", "ESG / BRSR", "Intelligence"] }
  };

  const roleFromIdentity = () => {
    const text = document.querySelector(".identity-bar span")?.textContent || "";
    const match = text.match(/^(.+?)\s·/);
    if (!match) return "";
    const known = { "Citizen / household": "citizen", "Farmer / rural producer": "farmer", "Waste collection worker": "safai_mitra", "FPO / rural enterprise": "fpo", "ULB / municipal authority": "municipal_admin", "Municipal / bulk generator": "municipal_generator", "Collector / aggregator / transporter": "aggregator", "MRF / recycler / processor": "processor", "Industrial generator": "industry_generator", "Commercial generator": "commercial_generator", "Institutional generator": "institution_generator", "Carbon project owner": "PROJECT_OWNER", "MRV / assurance user": "ACVA_USER", "Carbon / ESG buyer": "ccc_buyer", "EPR partner": "epr_partner", "CSR / ESG partner": "csr_partner", "Regulator / public authority": "regulator" };
    return known[match[1].trim()] || "";
  };

  function mountOperationalConsole() {
    if (document.getElementById("operational-console")) return;
    const anchor = document.querySelector(".workspace-panel");
    if (!anchor) return;
    const section = document.createElement("section");
    section.id = "operational-console";
    section.className = "operational-console lifecycle-operations";
    section.setAttribute("aria-label", "Authoritative operational controls");
    section.innerHTML = '<div class="section-heading"><div><p class="eyebrow">AUTHORITATIVE OPERATIONS</p><h2>Execute governed lifecycle actions</h2></div><span>Existing operational panels use the same authenticated API and server-side permissions</span></div><p class="field-help">These controls preserve the existing mutation workflows: field devices, resource-flow intake, MRV provenance, compliance/EPR, ESG reporting, registry/settlement and value lifecycle. No client-side state is treated as authoritative.</p>';
    const ids = ["field-device-management", "resource-flow-intake", "mrv-provenance", "compliance-assessment", "bwg-reporting", "esg-metrics", "registry-settlement", "value-lifecycle-management"];
    const grid = document.createElement("div");
    grid.className = "operational-panels";
    ids.forEach(id => { const node = document.getElementById(id); if (node) grid.appendChild(node); });
    section.appendChild(grid);
    anchor.insertAdjacentElement("afterend", section);
  }

  function scopeOperationalPanels(config) {
    const panelWorkspaces = {
      "field-device-management": ["Operations"],
      "resource-flow-intake": ["Operations"],
      "mrv-provenance": ["MRV & Evidence"],
      "compliance-assessment": ["Compliance & EPR"],
      "bwg-reporting": ["Compliance & EPR", "ESG / BRSR"],
      "esg-metrics": ["ESG / BRSR"],
      "registry-settlement": ["Registry", "Settlement"],
      "value-lifecycle-management": ["Carbon & Value", "Registry", "Settlement"]
    };
    Object.entries(panelWorkspaces).forEach(([id, allowed]) => {
      const node = document.getElementById(id);
      if (!node) return;
      const visible = allowed.some(workspace => config.workspaces.includes(workspace));
      node.hidden = !visible;
      node.setAttribute("aria-hidden", visible ? "false" : "true");
    });
  }

  function render() {
    const identity = document.querySelector(".identity-bar");
    const metrics = document.querySelector(".metrics");
    const tabs = document.querySelector(".workspace-tabs");
    if (!identity || !metrics || !tabs) return;
    const config = roleConfig[roleFromIdentity()];
    if (!config) return;

    mountOperationalConsole();
    scopeOperationalPanels(config);

    let panel = document.getElementById("role-command-center");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "role-command-center";
      panel.className = "role-command-center";
      metrics.parentNode?.insertBefore(panel, metrics);
    }
    panel.innerHTML = "";
    Object.assign(panel.style, { display: "grid", gridTemplateColumns: window.matchMedia("(max-width: 720px)").matches ? "minmax(0,1fr)" : "minmax(0,1fr) auto", gap: "18px", alignItems: "center", margin: "0 0 22px", padding: "18px 20px", border: "1px solid #28435c", borderRadius: "16px", background: "linear-gradient(135deg,rgba(15,34,52,.95),rgba(10,27,43,.82))" });

    const copy = document.createElement("div");
    const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow"; eyebrow.textContent = "STAKEHOLDER COMMAND CENTER";
    const title = document.createElement("h2"); title.textContent = config.title;
    const subtitle = document.createElement("p"); subtitle.textContent = config.subtitle; subtitle.style.cssText = "margin:7px 0 0;color:#7890a5;font-size:11px;line-height:1.5";
    copy.append(eyebrow, title, subtitle);

    const actions = document.createElement("div"); actions.style.cssText = "display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end";
    config.workspaces.forEach(name => {
      const target = Array.from(document.querySelectorAll(".workspace-tabs button")).find(button => button.textContent?.trim() === name);
      const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = name;
      if (target) button.addEventListener("click", () => target.click());
      else button.disabled = true;
      actions.appendChild(button);
    });
    panel.append(copy, actions);

    Array.from(tabs.querySelectorAll("button")).forEach(button => { button.hidden = !config.workspaces.includes(button.textContent?.trim() || ""); });
    const console = document.getElementById("operational-console");
    if (console) console.hidden = false;
  }

  let scheduled = false;
  const schedule = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; render(); }); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", schedule);
  window.addEventListener("resize", schedule);
  schedule();
})();