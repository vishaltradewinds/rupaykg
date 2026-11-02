import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const file = path.join(root, "docs", "ECOSYSTEM_STATE.json");
const state = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));

const allowed = new Set(["VERIFIED_DONE", "IN_PROGRESS", "BLOCKED", "UNVERIFIED", "NEXT", "NOT_STARTED"]);
const errors = [];
if (state.sourceOfTruth !== "vishaltradewinds/rupaykg") errors.push("Unexpected repository source of truth.");
if (!Array.isArray(state.items) || state.items.length === 0) errors.push("Checkpoint contains no items.");
for (const item of state.items ?? []) {
  if (!item.id || !item.area || !allowed.has(item.state) || !item.evidence) errors.push(`Invalid checkpoint item: ${JSON.stringify(item)}`);
}
const next = (state.items ?? []).filter(x => x.state === "NEXT");
if (next.length !== 1) errors.push(`Expected exactly one NEXT item; found ${next.length}.`);

let branch = "unknown", commit = "unknown", dirty = "unknown";
try { branch = execFileSync("git", ["branch", "--show-current"], {encoding:"utf8"}).trim(); } catch {}
try { commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {encoding:"utf8"}).trim(); } catch {}
try { dirty = execFileSync("git", ["status", "--porcelain"], {encoding:"utf8"}).trim() ? "DIRTY" : "CLEAN"; } catch {}

console.log(`Ecosystem checkpoint: ${file}`);
console.log(`Git: ${branch}@${commit} (${dirty})`);
console.log(`Source of truth: ${state.sourceOfTruth}`);
console.log(`Verified done: ${(state.items ?? []).filter(x => x.state === "VERIFIED_DONE").length}`);
console.log(`Blocked: ${(state.items ?? []).filter(x => x.state === "BLOCKED").length}`);
console.log(`Next: ${next[0]?.id ?? "NONE"}`);
if (next[0]) console.log(`Next evidence requirement: ${next[0].evidence}`);
if (errors.length) { console.error("CHECKPOINT INVALID"); errors.forEach(e => console.error(`- ${e}`)); process.exit(1); }
console.log("CHECKPOINT VALID");

