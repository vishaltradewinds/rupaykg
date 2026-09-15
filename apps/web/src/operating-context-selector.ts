const STORAGE_KEY = "rupaykg.operatingContext";
type OperatingContext = "urban" | "rural";

const readContext = (): OperatingContext =>
  window.localStorage.getItem(STORAGE_KEY) === "rural" ? "rural" : "urban";

const labels = {
  urban: { icon: "▦", label: "Urban", detail: "Municipal / Ward" },
  rural: { icon: "⌁", label: "Rural", detail: "Panchayat / Village" },
} as const;

function mount() {
  if (document.getElementById("rupaykg-operating-context")) return;

  const host = document.createElement("div");
  host.id = "rupaykg-operating-context";
  Object.assign(host.style, {
    position: "fixed",
    top: "14px",
    right: "14px",
    zIndex: "1000",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  });

  const select = document.createElement("select");
  select.id = "rupaykg-operating-context-select";
  select.setAttribute("aria-label", "Operating context");
  select.title = "Choose operating context";
  Object.assign(select.style, {
    appearance: "none",
    WebkitAppearance: "none",
    padding: "9px 32px 9px 12px",
    border: "1px solid rgba(87, 211, 255, .32)",
    borderRadius: "12px",
    background: "rgba(7, 17, 31, .94)",
    color: "#dbe7ef",
    font: "600 12px system-ui, sans-serif",
    outline: "none",
    boxShadow: "0 8px 28px rgba(0,0,0,.28)",
    cursor: "pointer",
  });

  (Object.keys(labels) as OperatingContext[]).forEach((context) => {
    const option = document.createElement("option");
    option.value = context;
    option.textContent = `${labels[context].icon} ${labels[context].label} · ${labels[context].detail}`;
    select.appendChild(option);
  });

  select.value = readContext();
  select.addEventListener("change", () => {
    const context = select.value as OperatingContext;
    window.localStorage.setItem(STORAGE_KEY, context);
    window.dispatchEvent(new CustomEvent("rupaykg:operating-context-change", { detail: context }));

    // The existing application owns its React state. A full reload makes the
    // selected context deterministic across every existing dashboard/panel.
    window.setTimeout(() => window.location.reload(), 50);
  });

  host.appendChild(select);
  document.body.appendChild(host);

  const live = document.createElement("span");
  live.setAttribute("aria-live", "polite");
  live.className = "sr-only";
  live.textContent = `Operating context: ${labels[readContext()].label}`;
  host.appendChild(live);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
