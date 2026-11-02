import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../apps/web/src/main.tsx");
const styles = read("../apps/web/src/styles.css");
const stakeholderCss = read("../apps/web/public/minimal-stakeholder.css");
const html = read("../apps/web/index.html");

assert.match(app, /className="landing-nav"/, "public landing navigation must exist");
assert.match(app, /aria-pressed=\{landingTab===key\}/, "landing navigation must expose selected state");
assert.match(app, /Choose your operating context/, "urban/rural context selector must exist");
assert.match(app, /aria-pressed=\{operatingContext==="urban"\}/, "urban context must expose selected state");
assert.match(app, /aria-pressed=\{operatingContext==="rural"\}/, "rural context must expose selected state");
assert.match(app, /selectedStakeholderCard/, "selected stakeholder outcome panel must exist");
assert.match(styles, /\.context-switch/, "urban/rural selector styling missing");
assert.match(styles, /\.stakeholder-selection/, "selected stakeholder outcome styling missing");
for (const label of ["Overview", "Stakeholders", "How it works", "Compliance"]) {
  assert.ok(app.includes(label), `missing landing navigation label: ${label}`);
}
for (const phrase of [
  "Make every waste and resource movement traceable.",
  "A shared digital infrastructure",
  "Record what happened, where and when.",
  "Track material across responsible organisations and locations.",
  "Review measurements and supporting evidence.",
  "Report verified outcomes and eligible next steps.",
  "Compliance by design."
]) {
  assert.ok(app.includes(phrase), `missing reference-aligned landing content: ${phrase}`);
}
assert.match(styles, /--rk-bg:\s*#050505/, "near-black reference canvas token missing");
assert.match(styles, /--rk-primary:\s*#10b981/, "emerald primary token missing");
assert.match(styles, /\.landing-nav\s*\{[^}]*display:flex!important/s, "landing navigation must remain visible");
assert.match(styles, /\.landing-panel\s*\{[^}]*display:block!important/s, "landing content panels must remain visible");
assert.match(styles, /prefers-reduced-motion/, "reduced-motion support missing");
assert.match(styles, /button:focus-visible/, "visible keyboard focus rule missing");
assert.doesNotMatch(stakeholderCss, /display:\s*none\s*!important/, "stakeholder stylesheet must not hide landing navigation or panels");
assert.match(html, /theme-color" content="#050505"/, "browser theme colour must match reference");
assert.match(html, /Traceable Material Flows/, "browser title must describe the platform");

console.log("RupayKg landing UX parity checks passed.");
