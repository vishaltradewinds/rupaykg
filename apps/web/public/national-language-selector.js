(() => {
  "use strict";

  const languages = [
    ["en-IN", "English", "English"],
    ["as-IN", "Assamese", "অসমীয়া"],
    ["bn-IN", "Bengali", "বাংলা"],
    ["brx-IN", "Bodo", "बड़ो"],
    ["doi-IN", "Dogri", "डोगरी"],
    ["gu-IN", "Gujarati", "ગુજરાતી"],
    ["hi-IN", "Hindi", "हिन्दी"],
    ["kn-IN", "Kannada", "ಕನ್ನಡ"],
    ["ks-IN", "Kashmiri", "کٲشُر"],
    ["kok-IN", "Konkani", "कोंकणी"],
    ["mai-IN", "Maithili", "मैथिली"],
    ["ml-IN", "Malayalam", "മലയാളം"],
    ["mni-IN", "Manipuri", "মৈতৈলোন্"],
    ["mr-IN", "Marathi", "मराठी"],
    ["ne-IN", "Nepali", "नेपाली"],
    ["or-IN", "Odia", "ଓଡ଼ିଆ"],
    ["pa-IN", "Punjabi", "ਪੰਜਾਬੀ"],
    ["sa-IN", "Sanskrit", "संस्कृतम्"],
    ["sat-IN", "Santali", "ᱥᱟᱱᱛᱟᱲᱤ"],
    ["sd-IN", "Sindhi", "سنڌي"],
    ["ta-IN", "Tamil", "தமிழ்"],
    ["te-IN", "Telugu", "తెలుగు"],
    ["ur-IN", "Urdu", "اردو"]
  ];

  const rtl = new Set(["ks-IN", "sd-IN", "ur-IN"]);
  const storageKey = "rupaykg.preferredLanguage";
  const read = () => localStorage.getItem(storageKey) || document.documentElement.lang || "en-IN";

  const apply = (code) => {
    const language = languages.find(item => item[0] === code) || languages[0];
    localStorage.setItem(storageKey, language[0]);
    document.documentElement.lang = language[0];
    document.documentElement.dir = rtl.has(language[0]) ? "rtl" : "ltr";
    window.dispatchEvent(new CustomEvent("rupaykg:language-changed", { detail: { code: language[0], label: language[1], nativeLabel: language[2] } }));
    return language;
  };

  function mount() {
    if (document.getElementById("rupaykg-national-language-selector")) return;
    const host = document.createElement("div");
    host.id = "rupaykg-national-language-selector";
    host.setAttribute("role", "region");
    host.setAttribute("aria-label", "Language selection");
    Object.assign(host.style, { position: "fixed", top: "12px", right: "14px", zIndex: "30", display: "flex", alignItems: "center", gap: "6px", padding: "5px 8px", border: "1px solid #314c63", borderRadius: "10px", background: "rgba(7,17,31,.94)", color: "#dbe7ef", font: "600 12px system-ui,sans-serif" });

    const label = document.createElement("label");
    label.htmlFor = "rupaykg-language-select";
    label.textContent = "Language";
    label.style.cursor = "pointer";

    const select = document.createElement("select");
    select.id = "rupaykg-language-select";
    select.setAttribute("aria-label", "Select application language");
    Object.assign(select.style, { maxWidth: "180px", padding: "5px 7px", borderRadius: "7px", border: "1px solid #526b7d", background: "#0d1d2b", color: "#f1f6fa" });
    languages.forEach(([code, labelText, nativeLabel]) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${nativeLabel} — ${labelText}`;
      select.appendChild(option);
    });
    select.value = read();
    select.addEventListener("change", () => apply(select.value));
    window.addEventListener("rupaykg:language-changed", event => {
      const code = event.detail?.code;
      if (code && select.value !== code) select.value = code;
    });
    host.append(label, select);
    document.body.appendChild(host);
    apply(select.value);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
