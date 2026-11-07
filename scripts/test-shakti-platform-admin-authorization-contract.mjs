#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/platform-admin-routes.ts", "utf8");
const transactionBlocks = source.match(/const result = await withPlatformTransaction\(pool, context\.auth\.identityId, async \(client\) => \{/g) ?? [];
const guardedBlocks = source.match(/const result = await withPlatformTransaction\(pool, context\.auth\.identityId, async \(client\) => \{\n\s*if \(!await assertPlatformPermission\(client, context\.auth\.identityId, "(?:admin:users|admin:roles|admin:security)", \)\)/g) ?? [];

if (transactionBlocks.length !== 8 || guardedBlocks.length !== 8) {
  console.error(`Platform-admin mutation authorization contract FAILED: transactions=${transactionBlocks.length}, guarded=${guardedBlocks.length}`);
  process.exit(1);
}

console.log("Platform-admin mutation authorization contract PASSED: all 8 platform mutation transactions re-check authority inside the protected transaction.");
