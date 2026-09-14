(() => {
  "use strict";

  const roleFromIdentity = () => {
    const text = document.querySelector(".identity-bar span")?.textContent || "";
    const match = text.match(/^(.+?)\s·/);
    if (!match) return "";
    const known = {
      "Citizen / household": "citizen",
      "Farmer / rural producer": "farmer",
      "Waste collection worker": "safai_mitra",
      "FPO / rural enterprise": "fpo",
      "ULB / municipal authority": "municipal_admin",
      "Municipal / bulk generator": "municipal_generator",
      "Collector / aggregator / transporter": "aggregator",
      "MRF / recycler / processor": "processor",
      "Industrial generator": "industry_generator",
      "Commercial generator": "commercial_generator",
      "Institutional generator": "institution_generator",
      "Carbon project owner": "PROJECT_OWNER",
      "MRV / assurance user": "ACVA_USER",
      "Carbon / ESG buyer": "ccc_buyer",
      "EPR partner": "epr_partner",
      "CSR / ESG partner": "csr_partner",
      "Regulator / public authority": "regulator",
      "Platform administrator": "platform_admin",
      "Platform super administrator": "super_admin"
    };
    return known[match[1].trim()] || "";
  };

  const journeys = {
    citizen: [["Record", "Record a real household/community activity", "Operations"], ["Evidence", "Add or review evidence", "MRV & Evidence"]],
    farmer: [["Record", "Record the farm activity", "Operations"], ["Evidence", "Capture evidence", "MRV & Evidence"], ["Value", "Review verified outcome", "Carbon & Value"]],
    safai_mitra: [["Collect", "Capture collection activity", "Operations"], ["Evidence", "Attach field evidence", "MRV & Evidence"]],
    aggregator: [["Move", "Record collection / transport", "Operations"], ["Evidence", "Attach movement evidence", "MRV & Evidence"]],
    processor: [["Process", "Record processing activity", "Operations"], ["Evidence", "Capture processing evidence", "MRV & Evidence"]],
    fpo: [["Operate", "Record rural resource flow", "Operations"], ["Verify", "Complete evidence / MRV", "MRV & Evidence"], ["Comply", "Check obligations", "Compliance & EPR"], ["Value", "Review value", "Carbon & Value"], ["Report", "Prepare reporting", "ESG / BRSR"]],
    municipal_admin: [["Operate", "Monitor authorised operations", "Operations"], ["Verify", "Review MRV", "MRV & Evidence"], ["Comply", "Check compliance", "Compliance & EPR"], ["Report", "Review ESG outputs", "ESG / BRSR"]],
    municipal_generator: [["Record", "Record generator operations", "Operations"], ["Evidence", "Capture evidence", "MRV & Evidence"], ["Comply", "Assess SWM / EPR applicability", "Compliance & EPR"], ["Report", "Prepare ESG reporting", "ESG / BRSR"]],
    industry_generator: [["Record", "Record source activity", "Operations"], ["Verify", "Complete MRV evidence", "MRV & Evidence"], ["Comply", "Check EPR / compliance", "Compliance & EPR"], ["Value", "Review carbon value", "Carbon & Value"], ["Report", "Prepare ESG reporting", "ESG / BRSR"]],
    commercial_generator: [["Record", "Record waste activity", "Operations"], ["Verify", "Review MRV", "MRV & Evidence"], ["Comply", "Check applicable obligations", "Compliance & EPR"], ["Report", "Review ESG evidence", "ESG / BRSR"]],
    institution_generator: [["Record", "Record institutional activity", "Operations"], ["Verify", "Review MRV", "MRV & Evidence"], ["Comply", "Check BWG / EPR applicability", "Compliance & EPR"], ["Report", "Prepare ESG evidence", "ESG / BRSR"]],
    PROJECT_OWNER: [["Verify", "Review verified activity", "MRV & Evidence"], ["Value", "Review methodology / value", "Carbon & Value"], ["Registry", "Review registry eligibility", "Registry"]],
    ACVA_USER: [["Evidence", "Review authoritative evidence", "MRV & Evidence"], ["Verify", "Review methodology / verification", "Carbon & Value"], ["Registry", "Review registry eligibility", "Registry"]],
    ccc_buyer: [["Value", "Review verified value", "Carbon & Value"], ["Registry", "Review ownership / registry", "Registry"], ["Settle", "Review settlement", "Settlement"], ["Report", "Review ESG evidence", "ESG / BRSR"]],
    epr_partner: [["Comply", "Check applicability / obligations", "Compliance & EPR"], ["Evidence", "Review evidence", "MRV & Evidence"], ["Report", "Review reporting state", "ESG / BRSR"]],
    csr_partner: [["Evidence", "Inspect authoritative evidence", "MRV & Evidence"], ["Value", "Review value context", "Carbon & Value"], ["Comply", "Review compliance context", "Compliance & EPR"], ["Report", "Review environmental outcomes", "ESG / BRSR"]],
    regulator: [["Comply", "Inspect compliance", "Compliance & EPR"], ["Provenance", "Inspect MRV / provenance", "MRV & Evidence"], ["Registry", "Inspect registry state", "Registry"], ["Report", "Inspect ESG reporting", "ESG / BRSR"], ["Intelligence", "Review advisory intelligence", "Intelligence"]],
    platform_admin: [["Govern", "Review stakeholder onboarding and governance", "Operations"], ["Evidence", "Review authorised evidence", "MRV & Evidence"], ["Comply", "Inspect compliance state", "Compliance & EPR"], ["Report", "Review ESG outputs", "ESG / BRSR"]],
    super_admin: [["Govern", "Review stakeholder onboarding and governance", "Operations"], ["Evidence", "Review authoritative evidence", "MRV & Evidence"], ["Comply", "Inspect compliance state", "Compliance & EPR"], ["Value", "Review value and registry state", "Carbon & Value"], ["Registry", "Review registry lifecycle", "Registry"], ["Settle", "Review settlement and reconciliation", "Settlement"], ["Report", "Review ESG outputs", "ESG / BRSR"]]
  };

  function render() {
    const identity = document.querySelector(".identity-bar");
    const metrics = document.querySelector(".metrics");
    const tabs = document.querySelector(".workspace-tabs");
    if (!identity || !metrics || !tabs) return;
    const role = roleFromIdentity();
    const steps = journeys[role];
    if (!steps?.length) return;
    let guide = document.getElementById("stakeholder-journey-guide");
    if (!guide) {
      guide = document.createElement("section");
      guide.id = "stakeholder-journey-guide";
      guide.setAttribute("aria-label", "Stakeholder journey guidance");
      metrics.parentNode?.insertBefore(guide, metrics);
    }
    guide.replaceChildren();
    Object.assign(guide.style, { margin: "0 0 22px", padding: "16px 18px", border: "1px solid #28435c", borderRadius: "16px", background: "rgba(8,24,39,.78)" });
    const heading = document.createElement("div");
    heading.style.cssText = "display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap";
    const title = document.createElement("h3"); title.textContent = "Your journey"; title.style.margin = "0";
    const note = document.createElement("span"); note.textContent = "Guidance follows your authorised workspace access"; note.style.cssText = "font-size:11px;color:#7890a5";
    heading.append(title, note); guide.appendChild(heading);
    const list = document.createElement("div"); list.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:12px";
    steps.forEach(([label, action, workspace], index) => {
      const card = document.createElement("article"); Object.assign(card.style, { minWidth: "0", padding: "11px", border: "1px solid #233b50", borderRadius: "12px", background: "rgba(15,34,52,.72)" });
      const step = document.createElement("div"); step.textContent = `Step ${index + 1} · ${label}`; step.style.cssText = "font-size:10px;font-weight:700;color:#7dd3fc;text-transform:uppercase;letter-spacing:.06em";
      const text = document.createElement("div"); text.textContent = action; text.style.cssText = "margin-top:4px;font-weight:650;line-height:1.35";
      const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = workspace; button.style.cssText = "margin-top:9px;width:100%;min-height:40px";
      const target = Array.from(tabs.querySelectorAll("button")).find(b => b.textContent?.trim() === workspace);
      if (target && !target.hidden) button.addEventListener("click", () => target.click()); else button.disabled = true;
      card.append(step, text, button); list.appendChild(card);
    });
    guide.appendChild(list);
  }

  let scheduled = false;
  const schedule = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; render(); }); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  schedule();
})();
