import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Pool } from "pg";

const dir = path.resolve("migrations");
const files = (await readdir(dir))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

const numbers = new Set();
const objects = new Map();
const sourceByVersion = new Map();

for (const file of files) {
  const number = Number(file.match(/^\d+/)[0]);
  if (numbers.has(number)) throw new Error(`duplicate migration number: ${number} (${file})`);
  numbers.add(number);
  sourceByVersion.set(String(number), file);

  const sql = await readFile(path.join(dir, file), "utf8");
  const sha256 = createHash("sha256").update(sql).digest("hex");
  const patterns = [
    /create\s+type\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi,
    /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of sql.matchAll(pattern)) {
      const object = match[1].toLowerCase();
      const prior = objects.get(object);
      if (prior) throw new Error(`duplicate database object '${object}' in ${prior} and ${file}`);
      objects.set(object, file);
    }
  }

  console.log(`SOURCE ${number} ${file} sha256=${sha256}`);
}

console.log(`Validated ${files.length} migrations and ${objects.size} schema objects.`);

const databaseUrl = process.env.MIGRATION_LINEAGE_DATABASE_URL;
if (!databaseUrl) {
  console.log("Ledger reconciliation skipped: MIGRATION_LINEAGE_DATABASE_URL is not set.");
  process.exit(0);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: process.env.MIGRATION_LINEAGE_DATABASE_SSL === "false"
    ? undefined
    : { rejectUnauthorized: false },
});

try {
  const columns = await pool.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'schema_migrations'
      order by ordinal_position
    `,
  );

  if (columns.rows.length === 0) {
    throw new Error("public.schema_migrations does not exist");
  }

  const ledger = await pool.query<{ version: string; filename: string }>(
    "select version, filename from public.schema_migrations order by version",
  );

  const missingSource = ledger.rows.filter((row) => !sourceByVersion.has(row.version));
  const filenameMismatch = ledger.rows.filter(
    (row) => sourceByVersion.has(row.version) && sourceByVersion.get(row.version) !== row.filename,
  );
  const sourceNotRecorded = files
    .map((filename) => ({ version: filename.split("_", 1)[0], filename }))
    .filter((row) => !ledger.rows.some((entry) => entry.version === row.version));

  if (missingSource.length || filenameMismatch.length || sourceNotRecorded.length) {
    console.error("MIGRATION LINEAGE FAILED");
    if (missingSource.length) {
      console.error("Ledger versions without active source:");
      for (const row of missingSource) console.error(`  ${row.version}: ${row.filename}`);
    }
    if (filenameMismatch.length) {
      console.error("Ledger filename/source filename mismatches:");
      for (const row of filenameMismatch) console.error(`  ${row.version}: ledger=${row.filename} source=${sourceByVersion.get(row.version)}`);
    }
    if (sourceNotRecorded.length) {
      console.error("Active source files not recorded in ledger:");
      for (const row of sourceNotRecorded) console.error(`  ${row.version}: ${row.filename}`);
    }
    console.error("Ledger/source hashes are not available in the current schema_migrations table; exact historical SQL integrity therefore requires an external immutable evidence manifest.");
    process.exitCode = 1;
  } else {
    console.log(`MIGRATION LINEAGE PASSED: ${ledger.rows.length} ledger rows reconcile to ${files.length} active source files.`);
    console.log("NOTE: schema_migrations has no source checksum column; hash-level historical integrity is not proven by this check.");
  }
} finally {
  await pool.end();
}
