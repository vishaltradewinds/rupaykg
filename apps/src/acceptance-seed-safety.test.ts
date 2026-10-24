import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8")) as {
  scripts: { start: string };
};
const seedSource = readFileSync(fileURLToPath(new URL("../../src/acceptance-seed.ts", import.meta.url)), "utf8");

test("production start never invokes the acceptance fixture seed", () => {
  assert.equal(packageJson.scripts.start, "node dist/src/production-server.js");
  assert.equal(packageJson.scripts.start.includes("acceptance-seed"), false);
});

test("explicit acceptance seeding is blocked in production and verifies database TLS by default", () => {
  assert.match(seedSource, /NODE_ENV === "production"/);
  assert.match(seedSource, /Acceptance fixture seeding is prohibited in production/);
  assert.match(seedSource, /rejectUnauthorized: true/);
  assert.match(seedSource, /DATABASE_CA_CERT/);
  assert.doesNotMatch(seedSource, /rejectUnauthorized: false/);
});
