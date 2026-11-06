import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const registerPath = path.resolve(new URL(".", import.meta.url).pathname, "../../../docs/engineering/TENANT_POLICY_CLASSIFICATION_WORKING_REGISTER_2026-11-06.md");

function section(text: string, heading: string, nextHeading: string): string {
  const start = text.indexOf(heading);
  assert.notEqual(start, -1, `missing policy section: ${heading}`);
  const end = text.indexOf(nextHeading, start + heading.length);
  return text.slice(start, end === -1 ? text.length : end);
}

function entries(block: string): string[] {
  return block.split("\n").map((line) => line.trim()).filter((line) => /^[a-z_]+$/.test(line));
}

test("tenant policy register is internally consistent and duplicate-free", async () => {
  const text = await readFile(registerPath, "utf8");
  const tenant = entries(section(text, "## Direct TENANT tables", "## BILATERAL tables"));
  const bilateral = entries(section(text, "## BILATERAL tables", "## INHERITED tables"));
  const inherited = entries(section(text, "## INHERITED tables", "## SHARED/ROOT tables"));
  const shared = entries(section(text, "## SHARED/ROOT tables", "## Critical live-schema findings"));

  const all = [...tenant, ...bilateral, ...inherited, ...shared];
  assert.equal(new Set(all).size, all.length, "policy register contains duplicate table classifications");
  assert.equal(all.length, 67, "policy register must cover the 67-table live schema inventory");
  assert.equal(tenant.length, 23, "TENANT classification count changed unexpectedly");
  assert.equal(bilateral.length, 8, "BILATERAL classification count changed unexpectedly");
  assert.equal(inherited.length, 22, "INHERITED classification count changed unexpectedly");
  assert.equal(shared.length, 14, "SHARED/ROOT classification count changed unexpectedly");
});
