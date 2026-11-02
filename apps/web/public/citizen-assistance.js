(() => {
  "use strict";

  const uxStyles = "/src/ux-mobile.css";
  if (!document.querySelector(`link[href="${uxStyles}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = uxStyles;
    document.head.appendChild(link);
  }

  const rootId = "citizen-farmer-guided";
  const draftKey = "rupaykg.citizenFarmerDraft";

  const readDraft = () => {
    try {
      const value = localStorage.getItem(draftKey);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  };

  const saveDraft = (form) => {
    const data = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem(draftKey, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  };

  const clearDraft = () => localStorage.removeItem(draftKey);

  const speechRecognition = () => {
    const browserWindow = window;
    return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null;
  };

  const preferredLanguage = () => document.documentElement.lang || localStorage.getItem("rupaykg.preferredLanguage") || "en-IN";

  function mount() {
    const root = document.getElementById(rootId);
    if (!root || root.dataset.assistanceMounted === "true") return;
    const form = root.querySelector("form[data-form]");
    if (!form) return;
    root.dataset.assistanceMounted = "true";

    const controls = document.createElement("div");
    controls.className = "citizen-assistance-controls";
    controls.setAttribute("aria-label", "Assisted entry controls");
    Object.assign(controls.style, { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px", alignItems: "center" });

    const makeButton = (label, title, handler) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = label;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("click", handler);
      return button;
    };

    const status = document.createElement("span");
    status.className = "field-help";
    status.setAttribute("aria-live", "polite");

    const draft = readDraft();
    if (draft) {
      const kind = form.elements.namedItem("kind");
      const quantity = form.elements.namedItem("quantity");
      const unit = form.elements.namedItem("unit");
      if (kind instanceof HTMLSelectElement && draft.kind) kind.value = String(draft.kind);
      if (quantity instanceof HTMLInputElement && draft.quantity) quantity.value = String(draft.quantity);
      if (unit instanceof HTMLSelectElement && draft.unit) unit.value = String(draft.unit);
      status.textContent = "Saved draft restored. Review it before recording.";
    }

    const save = makeButton("Save draft", "Save this entry on this device for later", () => { saveDraft(form); status.textContent = "Draft saved on this device. It is not an authoritative record."; });
    const clear = makeButton("Clear draft", "Clear the saved draft on this device", () => { clearDraft(); form.reset(); status.textContent = "Saved draft cleared."; });
    const voice = makeButton("🎤 Voice", "Enter the active field using voice", () => {
      const Recognition = speechRecognition();
      if (!Recognition) { status.textContent = "Voice input is not available in this browser. You can type normally."; return; }
      const active = document.activeElement;
      const target = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : form.elements.namedItem("quantity");
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      const recognition = new Recognition();
      recognition.lang = preferredLanguage(); recognition.interimResults = false; recognition.maxAlternatives = 1;
      status.textContent = "Listening…";
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), "value")?.set;
        setter?.call(target, target.type === "number" ? transcript.replace(/[^0-9.,-]/g, "").replace(",", ".") : transcript);
        target.dispatchEvent(new Event("input", { bubbles: true })); target.dispatchEvent(new Event("change", { bubbles: true }));
        status.textContent = "Voice entry added. Review the value before recording.";
      };
      recognition.onerror = () => { status.textContent = "Voice input could not be completed. Please try again or type the value."; };
      recognition.onend = () => { if (status.textContent === "Listening…") status.textContent = "Voice input ended."; };
      recognition.start();
    });
    const read = makeButton("🔊 Read", "Read this guided entry form aloud", () => {
      if (!("speechSynthesis" in window)) { status.textContent = "Read-aloud is not available in this browser."; return; }
      window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance((root.innerText || "").slice(0, 3000)); utterance.lang = preferredLanguage(); window.speechSynthesis.speak(utterance); status.textContent = "Reading the guided entry aloud.";
    });
    const stop = makeButton("■ Stop", "Stop read-aloud", () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); status.textContent = "Read-aloud stopped."; });

    controls.append(save, clear, voice, read, stop, status);
    const actions = root.querySelector(".resource-flow-actions");
    if (actions) actions.insertAdjacentElement("afterend", controls);
    form.addEventListener("input", () => { if (document.visibilityState === "hidden") saveDraft(form); });
    form.addEventListener("submit", () => clearDraft());
    window.addEventListener("beforeunload", () => { const quantity = form.elements.namedItem("quantity"); if (quantity instanceof HTMLInputElement && quantity.value) saveDraft(form); });
  }

  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  mount();
})();
