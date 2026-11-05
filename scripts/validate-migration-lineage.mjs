import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Pool } from "pg";

const migrationDir = path.resolve("migrations");
const files = (await readdir(migrationDir))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

const sourceByVersion = new Map();

for (const filename of files) {
  const version = filename.split("_", 1)[0];
  if (sourceByVersion.has(version)) {
    throw new Error(`duplicate migration version: ${version} (${filename} and ${sourceByVersion.get(version)})`);
  }

  sourceByVersion.set(version, filename);
  const sql = await readFile(path.join(migrationDir, filename), "utf8");
  const sha256 = createHash("sha256").update(sql).digest("hex");
  console.log(`SOURCE ${version} ${filename} sha256=${sha256}`);
}

console.log(`Validated ${files.length} migration source files.`);

const databaseUrl = process.env.MIGRATION_LINEAGE_DATABASE_URL;
if (!databaseUrl) {
  console.log("Ledger reconciliation skipped: MIGRATION_LINEAGE_DATABASE_URL is not set.");
  process.exit(0);
}

if (process.env.DATABASE_URL && databaseUrl === process.env.DATABASE_URL) {
  throw new Error("MIGRATION_LINEAGE_DATABASE_URL must be explicitly separated from DATABASE_URL");
}

const caPath = process.env.MIGRATION_LINEAGE_DATABASE_SSL_CA_CERT;
const ssl =
  process.env.MIGRATION_LINEAGE_DATABASE_SSL === "false"
    ? undefined
    : process.env.MIGRATION_LINEAGE_DATABASE_SSL_STRICT === "true"
      ? { rejectUnauthorized: true, ...(caPath ? { ca: await readFile(caPath, "utf8") } : {}) }
      : { rejectUnauthorized: true };

if (process.env.MIGRATION_LINEAGE_DATABASE_SSL !== "false" && !caPath) {
  throw new Error(
    "MIGRATION_LINEAGE_DATABASE_SSL_CA_CERT is required for read-only lineage reconciliation unless SSL is explicitly disabled",
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl,
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

  const columnNames = new Set(columns.rows.map((row) => row.column_name));
  if (!columnNames.has("version") || !columnNames.has("filename")) {
    throw new Error("public.schema_migrations must expose version and filename columns");
  }

  const ledger = await pool.query<{ version: string; filename: string }>(
    "select version, filename from public.schema_migrations order by version",
  );

  const ledgerByVersion = new Map<string, string>();
  const duplicateLedgerVersions: string[] = [];
  for (const row of ledger.rows) {
    if (ledgerByVersion.has(row.version)) duplicateLedgerVersions.push(row.version);
    ledgerByVersion.set(row.version, row.filename);
  }

  const missingSource = ledger.rows.filter((row) => !sourceByVersion.has(row.version));
  const filenameMismatch = ledger.rows.filter(
    (row) => sourceByVersion.has(row.version) && sourceByVersion.get(row.version) !== row.filename,
  );
  const sourceNotRecorded = files
    .map((filename) => ({ version: filename.split("_", 1)[0], filename }))
    .filter((row) => !ledgerByVersion.has(row.version));

  if (duplicateLedgerVersions.length || missingSource.length || filenameMismatch.length || sourceNotRecorded.length) {
    console.error("MIGRATION LINEAGE FAILED");

    if (duplicateLedgerVersions.length) {
      console.error(`Duplicate ledger versions: ${duplicateLedgerVersions.join(", ")}`);
    }
    if (missingSource.length) {
      console.error("Ledger versions without active source:");
      for (const row of missingSource) console.error(`  ${row.version}: ${row.filename}`);
    }
    if (filenameMismatch.length) {
      console.error("Ledger filename/source filename mismatches:");
      for (const row of filenameMismatch) {
        console.error(`  ${row.version}: ledger=${row.filename} source=${sourceByVersion.get(row.version)}`);
      }
    }
    if (sourceNotRecorded.length) {
      console.error("Active source files not recorded in ledger:");
      for (const row of sourceNotRecorded) console.error(`  ${row.version}: ${row.filename}`);
    }

    console.error(
      "schema_migrations has no source checksum column; exact historical SQL integrity therefore requires an external immutable evidence manifest.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      `MIGRATION LINEAGE PASSED: ${ledger.rows.length} ledger rows reconcile to ${files.length} active source files.`,
    );
    console.log(
      "NOTE: schema_migrations has no source checksum column; hash-level historical integrity is not proven by this check.",
    );
  }
} finally {
  await pool.end();
}
