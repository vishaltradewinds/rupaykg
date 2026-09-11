(() => {
  "use strict";

  // Presentation-only role projection. Server-side RBAC remains authoritative.
  const roleConfig = {
    citizen: { title: "Community activity", subtitle: "Record and follow verified local resource activity.", workspaces: ["Resource flows", "MRV"], operations: ["Field MRV intake"] },
    farmer: { title: "Rural resource activity", subtitle: "Capture authorised activity, evidence and verified outcomes for your geography.", workspaces: ["Resource flows", "MRV", "Carbon"], operations: ["Field MRV intake", "Carbon calculation"] },
    safai_mitra: { title: "Field collection", subtitle: "Capture field activity and evidence only within your authorised geography.", workspaces: ["Resource flows", "MRV"], operations: ["Field MRV intake"] },
    fpo: { title: "Rural enterprise", subtitle: "Track resource flows, verified activity and applicable value workflows.", workspaces: ["Resource flows", "MRV", "Carbon", "Compliance", "EPR & ESG reporting"], operations: ["Field MRV intake", "Carbon calculation"] },
    municipal_admin: { title: "ULB operations", subtitle: "Monitor authorised resource flows, MRV, compliance and governance records.", workspaces: ["Resource flows", "MRV", "Compliance", "EPR & ESG reporting"], operations: ["Field MRV intake"] },
    municipal_generator: { title: "Municipal / bulk generator", subtitle: "Manage authoritative SWM, EPR and ESG records without implying external submission or acceptance.", workspaces: ["Resource flows", "MRV", "Compliance", "EPR & ESG reporting"], operations: ["Field MRV intake"] },
    aggregator: { title: "Aggregation & transport", subtitle: "Track authorised collection, movement, evidence and downstream processing records.", workspaces: ["Resource flows", "MRV"], operations: ["Field MRV intake"] },
    processor: { title: "Processing & recycling", subtitle: "Track processing evidence and MRV verification within your authorised operating scope.", workspaces: ["Resource flows", "MRV", "Compliance"], operations: ["Field MRV intake"] },
    industry_generator: { title: "Industrial generator", subtitle: "Operate verified resource, compliance, EPR/ESG, carbon and reporting workflows.", workspaces: ["Resource flows", "MRV", "Compliance", "Carbon", "EPR & ESG reporting"], operations: ["Field MRV intake", "Carbon calculation"] },
    commercial_generator: { title: "Commercial generator", subtitle: "Operate verified waste, BWG, EPR and ESG reporting workflows where applicable.", workspaces: ["Resource flows", "Compliance", "EPR & ESG reporting", "MRV"], operations: ["Field MRV intake"] },
    institution_generator: { title: "Institutional generator", subtitle: "Maintain authoritative waste, BWG, compliance and ESG records.", workspaces: ["Resource flows", "Compliance", "EPR & ESG reporting", "MRV"], operations: ["Field MRV intake"] },
    PROJECT_OWNER: { title: "Environmental project", subtitle: "Move verified activity through methodology and registry controls; settlement remains separately permission-gated.", workspaces: ["MRV", "Carbon", "Registry"], operations: ["Field MRV intake", "Carbon calculation"] },
    ACVA_USER: { title: "Verification workspace", subtitle: "Review authoritative evidence and verification state without bypassing server controls.", workspaces: ["MRV", "Carbon", "Registry"], operations: [] },
    ccc_buyer: { title: "Carbon / ESG buyer", subtitle: "Review verified environmental value, registry state, settlement and ESG records.", workspaces: ["Carbon", "Registry", "Settlement", "EPR & ESG reporting"], operations: [] },
    epr_partner: { title: "EPR operations", subtitle: "Review applicable obligations, verified evidence and EPR/ESG reporting state.", workspaces: ["Compliance", "MRV", "EPR & ESG reporting"], operations: [] },
    csr_partner: { title: "ESG / CSR operations", subtitle: "Review authoritative environmental outcomes and reporting evidence.", workspaces: ["EPR & ESG reporting", "MRV", "Carbon", "Compliance"], operations: [] },
    regulator: { title: "Regulatory oversight", subtitle: "Inspect authorised records, provenance and governance state. High-risk mutations remain server-gated.", workspaces: ["Compliance", "MRV", "Registry", "EPR & ESG reporting", "Intelligence"], operations: [] }
  };

  const workspaceButton = (name) => Array.from(document.querySelectorAll(".workspace-tabs button")).find((button) => button.textContent?.trim() === name);
  const mountTarget = (name) => name === "ESG" ? document.getElementById("esg-metrics") : name === "EPR" || name === "EPR & ESG reporting" ? document.getElementById("bwg-reporting") : null;
  const roleFromIdentity = () => {
    const text = document.querySelector(".identity-bar span")?.textContent || "";
    const match = text.match(/^(.+?)\s·/);
    if (!match) return "";
    const known = { "Citizen / household": "citizen", "Farmer / rural producer": "farmer", "Waste collection worker": "safai_mitra", "FPO / rural enterprise": "fpo", "ULB / municipal authority": "municipal_admin", "Municipal / bulk generator": "municipal_generator", "Aggregator / transporter": "aggregator", "MRF / recycler / processor": "processor", "Industrial generator": "industry_generator", "Commercial generator": "commercial_generator", "Institutional generator": "institution_generator", "Carbon project owner": "PROJECT_OWNER", "ACVA user": "ACVA_USER", "Carbon / ESG buyer": "ccc_buyer", "EPR partner": "epr_partner", "CSR / ESG partner": "csr_partner", "Regulator / public authority": "regulator" };
    return known[match[1].trim()] || "";
  };

  function render() {
    const identity = document.querySelector(".identity-bar");
    const metrics = document.querySelector(".metrics");
    const tabs = document.querySelector(".workspace-tabs");
    const operationGrid = document.querySelector(".operation-grid");
    if (!identity || !metrics || !tabs || !operationGrid) return;
    const config = roleConfig[roleFromIdentity()];
    if (!config) return;

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
    config.workspaces.forEach((name) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = name;
      const target = workspaceButton(name);
      if (target) button.addEventListener("click", () => target.click());
      else {
        const mount = mountTarget(name);
        if (!mount) { button.disabled = true; button.title = "Workspace is not available for this session"; }
        else button.addEventListener("click", () => mount.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      actions.appendChild(button);
    });
    panel.append(copy, actions);

    Array.from(tabs.querySelectorAll("button")).forEach((button) => {
      button.hidden = !config.workspaces.includes(button.textContent?.trim() || "");
    });
    Array.from(operationGrid.querySelectorAll("article")).forEach((article) => {
      article.hidden = !config.operations.includes(article.querySelector("h3")?.textContent?.trim() || "");
    });
    const operationConsole = document.querySelector(".operation-console");
    if (operationConsole) operationConsole.hidden = config.operations.length === 0;
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", schedule);
  window.addEventListener("resize", schedule);
  schedule();
})();