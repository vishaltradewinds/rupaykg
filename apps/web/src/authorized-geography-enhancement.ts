const PANEL_ID = "rupaykg-field-capture";
const ENHANCED = "data-rupaykg-geography-enhanced";
const ORG_KEY = "rupaykg.activeOrganizationId";

function optionText(g: any, depth: number): string {
  const name = String(g?.name || g?.code || g?.id || "Geography");
  const kind = g?.kind ? ` · ${g.kind}` : "";
  return `${"\u00a0\u00a0".repeat(Math.min(depth, 8))}${name}${kind}`;
}

function apiHeaders(): HeadersInit {
  const headers = new Headers({ Accept: "application/json" });
  const org = localStorage.getItem(ORG_KEY);
  if (org) headers.set("X-RupayKG-Organization-Id", org);
  const token = (window as any).rupaykgSessionToken;
  if (typeof token === "string" && token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function enhance(panel: HTMLElement): Promise<void> {
  if (panel.getAttribute(ENHANCED) === "true") return;
  const geography = panel.querySelector("form select:nth-of-type(3)") as HTMLSelectElement | null;
  if (!geography) return;
  const existing = Array.from(geography.options).map(option => ({ id: option.value, label: option.textContent || "" })).filter(x => x.id);
  if (!existing.length) return;

  geography.setAttribute("aria-label", "Authorized operational geography");
  geography.title = "Only geographies returned by the authorized geography API can be selected.";
  const hint = document.createElement("div");
  hint.textContent = "Authorized operational geography · select the most specific available level (ward / village / facility where applicable).";
  hint.style.cssText = "font-size:11px;opacity:.72;margin-top:-4px";
  geography.insertAdjacentElement("afterend", hint);

  const loadChildren = async (parentId: string, depth: number): Promise<any[]> => {
    const response = await fetch(`/api/v1/geography/children/${encodeURIComponent(parentId)}`, { headers: apiHeaders() });
    if (!response.ok) return [];
    const body = await response.json().catch(() => ({}));
    return Array.isArray(body?.data?.geography) ? body.data.geography : [];
  };

  // The authoritative roots endpoint already returns the full authorized tree.
  // Build a hierarchical option list locally so the submitted UUID remains the authoritative ID.
  const byParent = new Map<string, any[]>();
  existing.forEach(item => byParent.set(item.id, []));
  // Fetch direct children only when needed; this keeps the UI lightweight for large jurisdictions.
  geography.addEventListener("change", async () => {
    const selected = geography.value;
    if (!selected) return;
    const children = await loadChildren(selected, 0);
    if (!children.length) return;
    let childSelect = panel.querySelector("[data-rupaykg-child-geography]") as HTMLSelectElement | null;
    if (!childSelect) {
      childSelect = document.createElement("select");
      childSelect.setAttribute("data-rupaykg-child-geography", "true");
      childSelect.setAttribute("aria-label", "More specific authorized geography");
      childSelect.style.cssText = geography.style.cssText;
      geography.insertAdjacentElement("afterend", childSelect);
    }
    childSelect.textContent = "";
    const placeholder = document.createElement("option");
    placeholder.textContent = "Select a more specific geography (optional)";
    placeholder.value = "";
    childSelect.appendChild(placeholder);
    children.forEach(g => {
      const option = document.createElement("option");
      option.value = String(g.id);
      option.textContent = optionText(g, 1);
      childSelect!.appendChild(option);
    });
    childSelect.onchange = () => {
      if (childSelect?.value) geography.value = childSelect.value;
    };
  });

  panel.setAttribute(ENHANCED, "true");
}

function mount(): void {
  const observer = new MutationObserver(() => {
    const panel = document.getElementById(PANEL_ID);
    if (panel) void enhance(panel);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const panel = document.getElementById(PANEL_ID);
  if (panel) void enhance(panel);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
