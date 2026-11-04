import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// Deliberately distinct from the API's DATABASE_URL. Production migrations
// must be invoked explicitly with a separately controlled migrator credential.
const databaseUrl = process.env.RUPAYKG_MIGRATOR_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("RUPAYKG_MIGRATOR_DATABASE_URL is required; API DATABASE_URL is never used for migrations");
}
let parsedDatabaseUrl: URL;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  throw new Error("RUPAYKG_MIGRATOR_DATABASE_URL must be a valid PostgreSQL URL");
}
if (parsedDatabaseUrl.protocol !== "postgres:" && parsedDatabaseUrl.protocol !== "postgresql:") {
  throw new Error("RUPAYKG_MIGRATOR_DATABASE_URL must use postgres:// or postgresql://");
}

const migrationSsl = process.env.RUPAYKG_MIGRATOR_DATABASE_SSL;
if (process.env.NODE_ENV === "production" && migrationSsl !== "require") {
  throw new Error("Production migrations require RUPAYKG_MIGRATOR_DATABASE_SSL=require");
}
if (migrationSsl && migrationSsl !== "require" && migrationSsl !== "false") {
  throw new Error("RUPAYKG_MIGRATOR_DATABASE_SSL must be require or false");
}
const caCert = process.env.RUPAYKG_MIGRATOR_DATABASE_CA_CERT?.trim();
if (migrationSsl === "require" && !caCert?.includes("BEGIN CERTIFICATE")) {
  throw new Error("RUPAYKG_MIGRATOR_DATABASE_CA_CERT must contain a PEM certificate when TLS is required");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ...(migrationSsl === "false"
    ? { ssl: false }
    : { ssl: { rejectUnauthorized: true, ...(caCert ? { ca: caCert } : {}) } }),
});

try {
  await pool.query(\`
    create table if not exists schema_migrations (
      version text primary key,
      filename text not null,
      applied_at timestamptz not null default now()
    )
  \`);

  // Support both CI/source execution (/repo/apps/src) and the production
  // container (/app/apps/dist/src). Never assume a single filesystem root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  const migrationDir = candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(\`Migration directory not found. Checked: \${candidates.join(", ")}\`);
  const files = (await readdir(migrationDir))
    .filter((name) => /^\\d+_.+\\.sql$/.test(name))
    .sort();

  // Never proceed when the target ledger contains a version whose source is
  // absent from the active migration directory. Archived sources must first
  // be restored/reconciled through the migration governance process.
  const activeVersions = new Set(files.map((filename) => filename.split("_", 1)[0]));
  const recorded = await pool.query<{ version: string; filename: string }>(
    "select version, filename from schema_migrations order by version",
  );
  const orphaned = recorded.rows.filter((row) => !activeVersions.has(row.version));
  if (orphaned.length) {
    throw new Error(
      \`Migration ledger contains versions with no active source file: \${orphaned.map((row) => \`\${row.version} (\${row.filename})\`).join(", ")}. Reconcile archived migration sources before proceeding.\`,
    );
  }

  for (const filename of files) {
    const version = filename.split("_", 1)[0];
    const existing = await pool.query<{ version: string; filename: string }>(
      "select version, filename from schema_migrations where version = $1",
      [version],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].filename !== filename) {
        throw new Error(\`Migration version \${version} is already recorded as \${existing.rows[0].filename}, not \${filename}\`);
      }
      continue;
    }

    const sql = await readFile(path.join(migrationDir, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into schema_migrations(version, filename) values ($1, $2)",
        [version, filename],
      );
      await client.query("commit");
      console.log(\`Applied \${filename}\`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(\`Migration \${filename} failed\`, { cause: error });
    } finally {
      client.release();
    }
  }

  console.log(\`Database migrations are current (\${files.length} files).\`);
} finally {
  await pool.end();
}
