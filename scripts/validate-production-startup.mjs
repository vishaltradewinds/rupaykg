import { readFile } from "node:fs/promises";

const dockerfile = await readFile("Dockerfile", "utf8");
const apiPackage = JSON.parse(await readFile("apps/package.json", "utf8"));
const acceptanceSeed = await readFile("apps/src/acceptance-seed.ts", "utf8");

if (/acceptance-seed\.js/.test(dockerfile)) {
  throw new Error("Production Docker startup must not invoke acceptance-seed.js");
}
if (/acceptance-seed\.js/.test(apiPackage.scripts?.start ?? "")) {
  throw new Error("API start script must not invoke acceptance-seed.js");
}
if (!/NODE_ENV\s*===\s*"production"[\s\S]*?Acceptance seeding is forbidden in production/.test(acceptanceSeed)) {
  throw new Error("Acceptance seed must explicitly fail closed in production");
}

console.log("Production startup is isolated from acceptance fixture seeding.");
