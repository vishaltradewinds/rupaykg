import { readFileSync } from "node:fs";

const token = process.env.GH_TOKEN;
const repository = process.env.GH_REPOSITORY;
const api = process.env.GH_API_URL || "https://api.github.com";
const branch = process.env.INPUT_BRANCH || "";
const expectedSha = process.env.INPUT_EXPECTED_SHA || "";
const confirmation = process.env.INPUT_CONFIRMATION || "";

if (!token || !repository) throw new Error("Missing GitHub Actions credentials/context.");
if (!/^[0-9a-f]{40}$/i.test(expectedSha)) throw new Error("Expected SHA must be a full 40-character commit SHA.");
if (confirmation !== "DELETE " + branch) throw new Error("Confirmation text does not exactly match DELETE <branch>.");

const manifest = JSON.parse(readFileSync("ops/github/branch-cleanup-manifest.json", "utf8"));
if (manifest.repository !== repository) throw new Error("Manifest repository mismatch.");
const entry = manifest.branches.find(item => item.name === branch);
if (!entry) throw new Error("Branch is not on the explicit cleanup allow-list.");
if (entry.sha.toLowerCase() !== expectedSha.toLowerCase()) throw new Error("Supplied SHA does not match the manifest.");

const headers = {
  authorization: "Bearer " + token,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28"
};
async function request(path, options = {}) {
  const response = await fetch(api + "/repos/" + repository + "/" + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const body = await response.text();
  if (!response.ok) throw new Error("GitHub API " + response.status + " for " + path + ": " + body);
  return body ? JSON.parse(body) : null;
}

const repo = await request("");
if (branch === repo.default_branch) throw new Error("Refusing to delete the default branch.");
const live = await request("branches/" + encodeURIComponent(branch));
if (live.name !== branch) throw new Error("Returned branch name mismatch.");
if (live.protected) throw new Error("Refusing to delete a protected branch.");
if (live.commit.sha.toLowerCase() !== expectedSha.toLowerCase()) throw new Error("Branch head changed since manifest creation; refusing deletion.");

const openPrs = await request("pulls?state=open&per_page=100");
const associated = openPrs.filter(pr => pr.head?.repo?.full_name === repository && pr.head.ref === branch);
if (associated.length) throw new Error("Refusing deletion: branch has open PR(s): " + associated.map(pr => "#" + pr.number).join(", "));

const ref = "git/refs/heads/" + branch;
const response = await fetch(api + "/repos/" + repository + "/" + ref, { method: "DELETE", headers });
if (response.status !== 204) throw new Error("Branch deletion failed or was not confirmed. HTTP " + response.status + ": " + await response.text());

console.log("Deleted branch " + branch + " at verified SHA " + expectedSha + ".");
console.log("The deletion was requested manually through GitHub Actions and recorded in this workflow run.");
