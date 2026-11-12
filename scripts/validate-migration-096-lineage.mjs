import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const target = "096_verification_authorization_provenance.sql";
const activeCandidates = [
  "migrations/096_verification_authorization_provenance.sql",
  "apps/migrations/096_verification_authorization_provenance.sql",
  "db/migrations/096_verification_authorization_provenance.sql",
  "database/migrations/096_verification_authorization_provenance.sql",
];

const active = activeCandidates.filter(existsSync);
if (active.length > 1) {
  throw new Error(`Migration 096 is ambiguous: multiple active source paths found: ${active.join(", ")}`);
}

const history = execFileSync("git", [
  "log", "--all", "--full-history", "--name-status", "--format=%H %s", "--", ...activeCandidates,
], { encoding: "utf8" });

const repositoryWideHistory = execFileSync("git", [
  "log", "--all", "--full-history", "-S", target, "--name-status", "--format=%H %s",
], { encoding: "utf8" });

const exactHistory = [history, repositoryWideHistory]
  .flatMap((value) => value.split("\n"))
  .filter((line, index, lines) => line.includes(target) && lines.indexOf(line) === index)
  .join("\n");

if (active.length === 1) {
  console.log(`Migration 096 active source: ${active[0]}`);
  console.log("Migration 096 lineage audit: PASS");
  process.exit(0);
}

if (exactHistory) {
  console.error("Migration 096 lineage audit: UNRESOLVED");
  console.error("Historical references exist, but no active authoritative source file is present.");
    console.error("Repository-wide content history was also searched for the exact migration filename.");
  console.error(exactHistory);
  process.exit(2);
}

console.error("Migration 096 lineage audit: UNRESOLVED");
console.error("No active authoritative source file or exact historical filename reference was found.");
process.exit(2);
