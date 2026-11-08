#!/usr/bin/env node
import fs from "node:fs";

const path = "docs/standards/SHAKTI_OPEN_SOURCE_ECOSYSTEM_CONTROL.md";
if (!fs.existsSync(path)) {
  console.error("Missing Shakti open-source ecosystem control document");
  process.exit(1);
}
const text = fs.readFileSync(path, "utf8");
const required = [
  "ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.",
  "Digital Public Goods Alliance (DPGA)",
  "UN Innovation Network (UNIN)",
  "FAIR Forward / BMZ",
  "Global DPI Repository",
  "relevant Indian DPI/open-source ecosystems",
  "component -> version -> license -> source -> security evidence -> test evidence -> deployment evidence -> owner -> replacement path",
  "instrument -> edge identity -> raw reading -> canonical measurement -> evidence -> MRV calculation -> audit event",
  "Discovery -> Feasibility -> Architecture -> Component selection -> Engineering -> Security -> Integration -> Verification -> Field validation -> Deployment -> Operations -> Continuous assurance"
];
const missing = required.filter(item => !text.includes(item));
if (missing.length) {
  console.error("Shakti open-source ecosystem contract FAILED");
  missing.forEach(item => console.error("- " + item));
  process.exit(1);
}
console.log("Shakti open-source ecosystem contract PASSED");
