(() => {
  "use strict";

  const roleConfig = {
    citizen: { title: "Community activity", subtitle: "Record and follow verified local resource activity.", workspaces: ["Resource flows", "MRV"], operations: ["Field MRV intake"] },
    farmer: { title: "Rural resource activity", subtitle: "Capture authorised activity, evidence and verified outcomes for your geography.", workspaces: ["Resource flows", "MRV", "Carbon"], operations: ["Field MRV intake", "Carbon calculation"] },
    safai_mitra: { title: "Field collection", subtitle: "Capture field activity and evidence only within your authorised geography.", workspaces: ["Resource flows", "MRV"], operations: ["Field MRV intake"] },
    fpo: { title: "Rural enterprise", subtitle: "Track resource flows, verified activity and applicable value workflows.", workspaces: ["Resource flows", "MRV", "Carbon", "Compliance"], operations: ["Field MRV intake", "Carbon calculation"] },
    municipal_admin: { title: "ULB operations", subtitle: "Monitor authorised resource flows, MRV, compliance and governance records.", workspaces: ["Resource flows", "MRV", "Compliance", "ESG"], operations: ["Field MRV intake"] },
    municipal_generator: { title: "Municipal / bulk generator", subtitle: "Manage operational records and applicable compliance reporting from authoritative data.", workspaces: ["Resource flows", "MRV", "Compliance", "ESG"], operations: ["Field MRV intake"] },
    aggregator: { title: "Aggregation & transport", subtitle: "Track authorised collection, movement, evidence and downstream processing records.", workspaces: ["Resource flows", "MRV", "Registry"], operations: ["Field MRV intake"] },
    processor: { title: "Processing & recycling", subtitle: "Track processing evidence, MRV verification and eligible registry outcomes.", workspaces: ["Resource flows", "MRV", "Compliance", "Registry"], operations: ["Field MRV intake", "Credential registry"] },
    industry_generator: { title: "Industrial generator", subtitle: "Operate verified resource, compliance, carbon and reporting workflows.", workspaces: ["Resource flows", "MRV", "Compliance", "Carbon", "ESG"], operations: ["Field MRV intake", "Carbon calculation"] },
    commercial_generator: { title: "Commercial generator", subtitle: "Operate verified waste, EPR and ESG reporting workflows where applicable.", workspaces: ["Resource flows", "Compliance", "ESG", "MRV"], operations: ["Field MRV intake"] },
    institution_generator: { title: "Institutional generator", subtitle: "Maintain authoritative waste, compliance and ESG records.", workspaces: ["Resource flows", "Compliance", "ESG", "MRV"], operations: ["Field MRV intake"] },
    PROJECT_OWNER: { title: "Environmental project", subtitle: "Move verified activity through methodology, registry and settlement controls.", workspaces: ["MRV", "Carbon", "Registry", "Settlement"], operations: ["Field MRV intake", "Carbon calculation", "Credential registry", "Settlement"] },
    ACVA_USER: { title: "Verification workspace", subtitle: "Review authoritative evidence and verification state without bypassing server controls.", workspaces: ["MRV", "Carbon", "Registry"], operations: ["Field MRV intake"] },
    ccc_buyer: { title: "Carbon / ESG buyer", subtitle: "Review verified environmental value, registry state and settlement records.", workspaces: ["Carbon", "Registry", "Settlement", "ESG"], operations: ["Credential registry", "Settlement"] },
    epr_partner: { title: "EPR operations", subtitle: "Review applicable obligations, verified evidence and EPR reporting state.", workspaces: ["Compliance", "MRV", "Resource flows", "ESG"], operations: ["Field MRV intake"] },
    csr_partner: { title: "ESG / CSR operations", subtitle: "Review authoritative environmental outcomes and reporting evidence.", workspaces: ["ESG", "MRV", "Carbon", "Compliance"], operations: ["Carbon calculation"] },
    regulator: { title: "Regulatory oversight", subtitle: "Inspect authorised records, provenance and governance state. High-risk mutations remain server-gated.", workspaces: ["Compliance", "MRV", "Registry", "ESG", "Intelligence"], operations: [] }
  };

  const workspaceAliases = { ESG: "Intelligence", Intelligence: "Intelligence" };
  const workspaceButton = (name) => Array.from(document.querySelectorAll(".workspace-tabs button")).find((button) => button.textContent?.trim() === name);
  const roleFromIdentity = () => {
    const text = document.querySelector(".identity-bar span")?.textContent || "";
    const match = text.match(/^(.+?)\s·/);
    if (!match) return "";
    const label = match[1].trim();
    const entry = Object.entries(roleConfig).find(([key]) => {
      const roleLabel = document.querySelector(`.onboarding-form option[value="${CSS.escape(key)}"]`)?.textContent?.trim();
      return roleLabel === label;
    });
    if (entry) return entry[0];
    const known = { "Citizen / household": "citizen", "Farmer / rural producer": "farmer", "Waste collection worker": "safai_mitra", "FPO / rural enterprise": "fpo", "ULB / municipal authority": "municipal_admin", "Municipal / bulk generator": "municipal_generator", "Aggregator / transporter": "aggregator", "MRF / recycler / processor": "processor", "Industrial generator": "industry_generator", "Commercial generator": "commercial_generator", "Institutional generator": "institution_generator", "Carbon project owner": "PROJECT_OWNER", "ACVA user": "ACVA_USER", "Carbon / ESG buyer": "ccc_buyer", "EPR partner": "epr_partner", "CSR / ESG partner": "csr_partner", "Regulator / public authority": "regulator" };
    return known[label] || "";
  };

  function render() {
    const identity = document.querySelector(".identity-bar");
    const metrics = document.querySelector(".metrics");
    const tabs = document.querySelector(".workspace-tabs");
    const operationGrid = document.querySelector(".operation-grid");
    if (!identity || !metrics || !tabs || !operationGrid) return;

    const role = roleFromIdentity();
    const config = roleConfig[role];
    if (!config) return;

    let panel = document.getElementById("role-command-center");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "role-command-center";
      panel.className = "role-command-center";
      metrics.parentNode?.insertBefore(panel, metrics);
    }

    panel.innerHTML = "";
    const copy = document.createElement("div");
    copy.className = "role-command-copy";
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "STAKEHOLDER COMMAND CENTER";
    const title = document.createElement("h2");
    title.textContent = config.title;
    const subtitle = document.createElement("p");
    subtitle.textContent = config.subtitle;
    copy.append(eyebrow, title, subtitle);

    const actions = document.createElement("div");
    actions.className = "role-command-actions";
    config.workspaces.forEach((workspace) => {
      const target = workspaceButton(workspace) || workspaceButton(workspaceAliases[workspace]);
      if (!target) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = workspace;
      button.addEventListener("click", () => target.click());
      actions.appendChild(button);
    });
    panel.append(copy, actions);

    Array.from(tabs.querySelectorAll("button")).forEach((button) => {
      const name = button.textContent?.trim() || "";
      button.hidden = !config.workspaces.includes(name) && !config.workspaces.includes(workspaceAliases[name]);
    });

    Array.from(operationGrid.querySelectorAll("article")).forEach((article) => {
      const heading = article.querySelector("h3")?.textContent?.trim() || "";
      const allowed = config.operations.includes(heading);
      article.hidden = !allowed;
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
  schedule();
})();
