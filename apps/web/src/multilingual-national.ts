export const NATIONAL_LANGUAGES = [
  { code: "en-IN", label: "English", nativeLabel: "English", direction: "ltr" },
  { code: "as-IN", label: "Assamese", nativeLabel: "অসমীয়া", direction: "ltr" },
  { code: "bn-IN", label: "Bengali", nativeLabel: "বাংলা", direction: "ltr" },
  { code: "brx-IN", label: "Bodo", nativeLabel: "बड़ो", direction: "ltr" },
  { code: "doi-IN", label: "Dogri", nativeLabel: "डोगरी", direction: "ltr" },
  { code: "gu-IN", label: "Gujarati", nativeLabel: "ગુજરાતી", direction: "ltr" },
  { code: "hi-IN", label: "Hindi", nativeLabel: "हिन्दी", direction: "ltr" },
  { code: "kn-IN", label: "Kannada", nativeLabel: "ಕನ್ನಡ", direction: "ltr" },
  { code: "ks-IN", label: "Kashmiri", nativeLabel: "कॉशुर / کٲشُر", direction: "rtl" },
  { code: "kok-IN", label: "Konkani", nativeLabel: "कोंकणी", direction: "ltr" },
  { code: "mai-IN", label: "Maithili", nativeLabel: "मैथिली", direction: "ltr" },
  { code: "ml-IN", label: "Malayalam", nativeLabel: "മലയാളം", direction: "ltr" },
  { code: "mni-IN", label: "Manipuri", nativeLabel: "মৈতৈলোন্", direction: "ltr" },
  { code: "mr-IN", label: "Marathi", nativeLabel: "मराठी", direction: "ltr" },
  { code: "ne-IN", label: "Nepali", nativeLabel: "नेपाली", direction: "ltr" },
  { code: "or-IN", label: "Odia", nativeLabel: "ଓଡ଼ିଆ", direction: "ltr" },
  { code: "pa-IN", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", direction: "ltr" },
  { code: "sa-IN", label: "Sanskrit", nativeLabel: "संस्कृतम्", direction: "ltr" },
  { code: "sat-IN", label: "Santali", nativeLabel: "ᱥᱟᱱᱛᱟᱲᱤ", direction: "ltr" },
  { code: "sd-IN", label: "Sindhi", nativeLabel: "सिन्धी / سنڌي", direction: "rtl" },
  { code: "ta-IN", label: "Tamil", nativeLabel: "தமிழ்", direction: "ltr" },
  { code: "te-IN", label: "Telugu", nativeLabel: "తెలుగు", direction: "ltr" },
  { code: "ur-IN", label: "Urdu", nativeLabel: "اردو", direction: "rtl" },
] as const;

export type NationalLanguageCode = typeof NATIONAL_LANGUAGES[number]["code"];
const STORAGE_KEY = "rupaykg.preferredLanguage";
const DEFAULT_LANGUAGE: NationalLanguageCode = "en-IN";

const findLanguage = (code: string) => NATIONAL_LANGUAGES.find((language) => language.code === code) ?? NATIONAL_LANGUAGES[0];

export function getPreferredLanguage(): NationalLanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return findLanguage(stored ?? DEFAULT_LANGUAGE).code;
}

export function setPreferredLanguage(code: string): NationalLanguageCode {
  const language = findLanguage(code);
  window.localStorage.setItem(STORAGE_KEY, language.code);
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.direction;
  window.dispatchEvent(new CustomEvent("rupaykg:language-changed", { detail: language }));
  return language.code;
}

export function languageDirection(code = getPreferredLanguage()): "ltr" | "rtl" {
  return findLanguage(code).direction;
}

export function languageLabel(code = getPreferredLanguage()): string {
  return findLanguage(code).nativeLabel;
}

export type TranslationKey =
  | "language"
  | "continue"
  | "save"
  | "cancel"
  | "submit"
  | "help"
  | "offline"
  | "syncPending"
  | "authoritative"
  | "verification"
  | "evidence"
  | "activity"
  | "recordActivity"
  | "requestPickup";

const coreTranslations: Partial<Record<NationalLanguageCode, Partial<Record<TranslationKey, string>>>> = {
  "hi-IN": { language: "भाषा", continue: "आगे बढ़ें", save: "सहेजें", cancel: "रद्द करें", submit: "जमा करें", help: "मदद", offline: "ऑफ़लाइन", syncPending: "सिंक होना बाकी है", authoritative: "प्रामाणिक रिकॉर्ड", verification: "सत्यापन", evidence: "प्रमाण", activity: "गतिविधि", recordActivity: "गतिविधि दर्ज करें", requestPickup: "पिकअप का अनुरोध करें" },
  "bn-IN": { language: "ভাষা", continue: "এগিয়ে যান", save: "সংরক্ষণ করুন", cancel: "বাতিল", submit: "জমা দিন", help: "সহায়তা", offline: "অফলাইন", syncPending: "সিঙ্ক বাকি", authoritative: "প্রামাণিক রেকর্ড", verification: "যাচাই", evidence: "প্রমাণ", activity: "কার্যকলাপ", recordActivity: "কার্যকলাপ নথিভুক্ত করুন", requestPickup: "পিকআপের অনুরোধ করুন" },
  "gu-IN": { language: "ભાષા", continue: "આગળ વધો", save: "સાચવો", cancel: "રદ કરો", submit: "સબમિટ કરો", help: "મદદ", offline: "ઑફલાઇન", syncPending: "સિંક બાકી", authoritative: "અધિકૃત રેકોર્ડ", verification: "ચકાસણી", evidence: "પુરાવો", activity: "પ્રવૃત્તિ", recordActivity: "પ્રવૃત્તિ નોંધો", requestPickup: "પિકઅપની વિનંતી કરો" },
  "mr-IN": { language: "भाषा", continue: "पुढे जा", save: "जतन करा", cancel: "रद्द करा", submit: "सबमिट करा", help: "मदत", offline: "ऑफलाइन", syncPending: "सिंक बाकी", authoritative: "अधिकृत नोंद", verification: "पडताळणी", evidence: "पुरावा", activity: "क्रियाकलाप", recordActivity: "क्रियाकलाप नोंदवा", requestPickup: "पिकअपची विनंती करा" },
  "ta-IN": { language: "மொழி", continue: "தொடரவும்", save: "சேமிக்கவும்", cancel: "ரத்துசெய்", submit: "சமர்ப்பிக்கவும்", help: "உதவி", offline: "ஆஃப்லைன்", syncPending: "ஒத்திசைவு நிலுவையில்", authoritative: "அங்கீகரிக்கப்பட்ட பதிவு", verification: "சரிபார்ப்பு", evidence: "ஆதாரம்", activity: "செயல்பாடு", recordActivity: "செயல்பாட்டைப் பதிவு செய்யவும்", requestPickup: "சேகரிப்பைக் கோரவும்" },
  "te-IN": { language: "భాష", continue: "కొనసాగించండి", save: "సేవ్ చేయండి", cancel: "రద్దు", submit: "సమర్పించండి", help: "సహాయం", offline: "ఆఫ్‌లైన్", syncPending: "సింక్ పెండింగ్", authoritative: "అధికారిక రికార్డు", verification: "ధృవీకరణ", evidence: "ఆధారం", activity: "కార్యకలాపం", recordActivity: "కార్యకలాపాన్ని నమోదు చేయండి", requestPickup: "పికప్ కోరండి" },
  "kn-IN": { language: "ಭಾಷೆ", continue: "ಮುಂದುವರಿಸಿ", save: "ಉಳಿಸಿ", cancel: "ರದ್ದುಮಾಡಿ", submit: "ಸಲ್ಲಿಸಿ", help: "ಸಹಾಯ", offline: "ಆಫ್‌ಲೈನ್", syncPending: "ಸಿಂಕ್ ಬಾಕಿ", authoritative: "ಅಧಿಕೃತ ದಾಖಲೆ", verification: "ಪರಿಶೀಲನೆ", evidence: "ಪುರಾವೆ", activity: "ಚಟುವಟಿಕೆ", recordActivity: "ಚಟುವಟಿಕೆಯನ್ನು ದಾಖಲಿಸಿ", requestPickup: "ಪಿಕಪ್ ವಿನಂತಿಸಿ" },
  "ml-IN": { language: "ഭാഷ", continue: "തുടരുക", save: "സേവ് ചെയ്യുക", cancel: "റദ്ദാക്കുക", submit: "സമർപ്പിക്കുക", help: "സഹായം", offline: "ഓഫ്‌ലൈൻ", syncPending: "സിങ്ക് ബാക്കി", authoritative: "ആധികാരിക രേഖ", verification: "പരിശോധന", evidence: "തെളിവ്", activity: "പ്രവർത്തനം", recordActivity: "പ്രവർത്തനം രേഖപ്പെടുത്തുക", requestPickup: "പിക്കപ്പ് അഭ്യർത്ഥിക്കുക" },
  "pa-IN": { language: "ਭਾਸ਼ਾ", continue: "ਜਾਰੀ ਰੱਖੋ", save: "ਸੰਭਾਲੋ", cancel: "ਰੱਦ ਕਰੋ", submit: "ਜਮ੍ਹਾਂ ਕਰੋ", help: "ਮਦਦ", offline: "ਆਫਲਾਈਨ", syncPending: "ਸਿੰਕ ਬਾਕੀ", authoritative: "ਅਧਿਕਾਰਤ ਰਿਕਾਰਡ", verification: "ਤਸਦੀਕ", evidence: "ਸਬੂਤ", activity: "ਗਤੀਵਿਧੀ", recordActivity: "ਗਤੀਵਿਧੀ ਦਰਜ ਕਰੋ", requestPickup: "ਪਿਕਅਪ ਦੀ ਬੇਨਤੀ ਕਰੋ" },
  "or-IN": { language: "ଭାଷା", continue: "ଆଗକୁ ବଢ଼ନ୍ତୁ", save: "ସଂରକ୍ଷଣ କରନ୍ତୁ", cancel: "ବାତିଲ କରନ୍ତୁ", submit: "ଦାଖଲ କରନ୍ତୁ", help: "ସହାୟତା", offline: "ଅଫଲାଇନ", syncPending: "ସିଙ୍କ ବାକି", authoritative: "ପ୍ରାମାଣିକ ରେକର୍ଡ", verification: "ଯାଞ୍ଚ", evidence: "ପ୍ରମାଣ", activity: "କାର୍ଯ୍ୟକଳାପ", recordActivity: "କାର୍ଯ୍ୟକଳାପ ରେକର୍ଡ କରନ୍ତୁ", requestPickup: "ପିକଅପ୍ ଅନୁରୋଧ କରନ୍ତୁ" },
  "ur-IN": { language: "زبان", continue: "جاری رکھیں", save: "محفوظ کریں", cancel: "منسوخ کریں", submit: "جمع کریں", help: "مدد", offline: "آف لائن", syncPending: "مطابقت باقی ہے", authoritative: "مستند ریکارڈ", verification: "تصدیق", evidence: "ثبوت", activity: "سرگرمی", recordActivity: "سرگرمی درج کریں", requestPickup: "پک اپ کی درخواست کریں" },
};

export function t(key: TranslationKey, language = getPreferredLanguage()): string {
  return coreTranslations[language]?.[key] ?? coreTranslations["hi-IN"]?.[key] ?? key;
}

function mountLanguageControl() {
  if (document.getElementById("rupaykg-national-language-control")) return;
  const control = document.createElement("section");
  control.id = "rupaykg-national-language-control";
  control.setAttribute("aria-label", "RupayKG language and accessibility");
  Object.assign(control.style, { position: "fixed", top: "12px", right: "12px", zIndex: "1000", display: "flex", gap: "7px", alignItems: "center", padding: "7px 9px", border: "1px solid #28435c", borderRadius: "12px", background: "rgba(7,17,31,.96)", color: "#dbe7ef", font: "600 12px system-ui,sans-serif", boxShadow: "0 8px 28px rgba(0,0,0,.28)" });
  const label = document.createElement("label");
  label.htmlFor = "rupaykg-language-select";
  label.textContent = t("language");
  const select = document.createElement("select");
  select.id = "rupaykg-language-select";
  select.setAttribute("aria-label", "Preferred language");
  select.style.cssText = "max-width:210px;background:#0b1a29;color:#dbe7ef;border:1px solid #39556d;border-radius:8px;padding:6px";
  NATIONAL_LANGUAGES.forEach((language) => { const option = document.createElement("option"); option.value = language.code; option.textContent = `${language.nativeLabel} — ${language.label}`; select.appendChild(option); });
  select.value = getPreferredLanguage();
  select.addEventListener("change", () => { setPreferredLanguage(select.value); label.textContent = t("language"); });
  control.append(label, select);
  document.body.appendChild(control);
}

function applyLanguagePreference() {
  const language = findLanguage(getPreferredLanguage());
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.direction;
}

if (typeof window !== "undefined") {
  applyLanguagePreference();
  const boot = () => mountLanguageControl();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
  window.addEventListener("rupaykg:language-changed", () => { applyLanguagePreference(); });
}

export const multilingualArchitecture = {
  languages: NATIONAL_LANGUAGES,
  canonicalDataInvariant: "Language is presentation metadata; activities, measurements, evidence, verification, MRV, registry, settlement and regulatory records remain language-neutral and authoritative.",
  translationFallback: "en-IN",
  accessibilityPrinciples: ["mobile-first", "low-bandwidth", "offline-capable", "voice-ready", "camera-first evidence", "large-touch-targets", "screen-reader-compatible", "assisted-field-mode"],
  translationProviderBoundary: "local-bundles-or-authoritative-language-service",
};
