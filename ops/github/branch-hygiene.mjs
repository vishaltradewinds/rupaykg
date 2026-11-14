import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const api = process.env.GITHUB_API_URL || "https://api.github.com";
if (!token || !repository) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");

async function getAll(path) {
  const items = [];
  for (let page = 1; ; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const url = api + "/repos/" + repository + "/" + path + separator + "per_page=100&page=" + page;
    const response = await fetch(url, {
      headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" }
    });
    if (!response.ok) throw new Error("GitHub API " + response.status + " for " + path + ": " + await response.text());
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Unexpected GitHub API response for " + path);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}
function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}
function csv(value) {
  return '"' + String(value ?? "").replaceAll('"', '""') + '"';
}

const repoInfoResponse = await fetch(api + "/repos/" + repository, {
  headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" }
});
if (!repoInfoResponse.ok) throw new Error("Repository lookup failed: " + repoInfoResponse.status);
const repoInfo = await repoInfoResponse.json();
const defaultBranch = repoInfo.default_branch;
const branches = await getAll("branches");
const openPRs = await getAll("pulls?state=open");
const prsByBranch = new Map();
for (const pr of openPRs) {
  if (pr.head?.repo?.full_name !== repository) continue;
  const key = pr.head.ref;
  prsByBranch.set(key, [...(prsByBranch.get(key) ?? []), "#" + pr.number]);
}

const rows = branches.map(branch => {
  const ref = "refs/remotes/origin/" + branch.name;
  let date = "";
  let ahead = "";
  let behind = "";
  try {
    date = git(["show", "-s", "--format=%cI", ref]);
    const counts = git(["rev-list", "--left-right", "--count", defaultBranch + "..." + ref]).split(/\s+/);
    behind = Number(counts[0]);
    ahead = Number(counts[1]);
  } catch {}
  const ageDays = date ? Math.floor((Date.now() - Date.parse(date)) / 86400000) : "";
  const openPRsForBranch = prsByBranch.get(branch.name) ?? [];
  let classification = "preserve-or-review";
  if (branch.name === defaultBranch) classification = "default-branch";
  else if (branch.protected) classification = "protected";
  else if (openPRsForBranch.length) classification = "has-open-pr";
  else if (ahead === 0 && behind > 0 && ageDays >= 30) classification = "cleanup-candidate-review";
  else if (ahead > 0) classification = "ahead-of-default-review";
  return {
    branch: branch.name,
    sha: branch.commit.sha,
    protected: branch.protected,
    commit_date: date,
    age_days: ageDays,
    ahead_of_default: ahead,
    behind_default: behind,
    open_prs: openPRsForBranch.join(" "),
    classification
  };
}).sort((a, b) => a.branch.localeCompare(b.branch));

const outputDir = "branch-hygiene-report";
mkdirSync(outputDir, { recursive: true });
const columns = ["branch", "sha", "protected", "commit_date", "age_days", "ahead_of_default", "behind_default", "open_prs", "classification"];
writeFileSync(outputDir + "/branches.csv", [columns.join(","), ...rows.map(row => columns.map(key => csv(row[key])).join(","))].join("\n") + "\n");
const candidates = rows.filter(row => row.classification === "cleanup-candidate-review");
const counts = rows.reduce((acc, row) => {
  acc[row.classification] = (acc[row.classification] ?? 0) + 1;
  return acc;
}, {});
const lines = [
  "# RupayKg branch hygiene report",
  "",
  "- Repository: " + repository,
  "- Default branch: " + defaultBranch,
  "- Default SHA: " + git(["rev-parse", "refs/remotes/origin/" + defaultBranch]),
  "- Branches scanned: **" + rows.length + "**",
  "- Open PRs scanned: **" + openPRs.length + "**",
  "- Potential cleanup candidates requiring human review: **" + candidates.length + "**",
  "",
  "## Classification",
  ...Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => "- " + key + ": " + value),
  "",
  "## Candidate review list",
  ...(candidates.length ? candidates.map(row => "- " + row.branch + " — " + row.sha + "; " + row.age_days + " days old; " + row.behind_default + " commits behind; no open PR found") : ["- None identified"]),
  "",
  "## Safety",
  "This workflow is read-only. It does not delete branches, close PRs, modify branch protection, merge code, or access production services.",
  "A candidate classification is not deletion approval. Review branch ownership, closed PR history, tags, deployments, and active work before any deletion."
];
writeFileSync(outputDir + "/report.md", lines.join("\n") + "\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
console.log("Scanned " + rows.length + " branches; " + candidates.length + " require manual cleanup review.");
