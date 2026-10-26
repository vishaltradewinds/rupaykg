import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("migration runner serializes the complete preflight and DDL window", () => {
  const source = readFileSync(fileURLToPath(new URL("../../src/migrate.ts", import.meta.url)), "utf8");
  const acquire = source.indexOf("await lockClient.query(MIGRATION_LOCK_SQL)");
  const preflight = source.indexOf("select to_regclass('public.schema_migrations')::text as ledger");
  const apply = source.indexOf("const sql = await readFile(path.join(migrationDir, filename)");
  const unlock = source.indexOf("await lockClient.query(MIGRATION_UNLOCK_SQL)");
  const release = source.indexOf("lockClient?.release()");
  assert.ok(acquire >= 0, "runner must acquire a PostgreSQL advisory lock");
  assert.ok(preflight > acquire, "ledger preflight must run after lock acquisition");
  assert.ok(apply > preflight, "migration DDL must run after locked preflight");
  assert.ok(unlock > apply, "lock must remain held through migration application");
  assert.ok(release > unlock, "lock session must be released after unlock");
  assert.match(source, /finally\s*\{\s*try\s*\{\s*if \(lockClient && lockAcquired\)/);
  assert.match(source, /new Pool\(\{ connectionString: databaseUrl, max: 2, ssl \}\)/);
});
