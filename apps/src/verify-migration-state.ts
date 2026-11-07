import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolConfig } from "pg";

type AppliedMigration = { version: string; filename: string };

function databaseConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required; this verifier never applies migrations.");
  const config: PoolConfig = { connectionString, max: 1, connectionTimeoutMillis: 8000, statement_timeout: 15000 };
  if (process.env.DATABASE_SSL === "false") config.ssl = false;
  else config.ssl = { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT } : {}) };
  return config;
}

function sanitizedEndpoint(): { host: string; port: number | null } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required; this verifier never applies migrations.");
  const parsed = new URL(connectionString);
  return { host: parsed.hostname, port: parsed.port ? Number(parsed.port) : null };
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  const migrationDir = candidates.find(existsSync);
  if (!migrationDir) throw new Error("Migration directory not found. Checked: " + candidates.join(", "));

  const filenames = (await readdir(migrationDir)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name)).sort();
  const expected = new Map<string, string>();
  for (const filename of filenames) {
    const version = filename.split("_", 1)[0]!;
    if (expected.has(version)) throw new Error("Duplicate migration version " + version + " in repository.");
    expected.set(version, filename);
  }

  const pool = new Pool(databaseConfig());
  try {
    const client = await pool.connect();
    try {
      await client.query("begin transaction isolation level repeatable read read only");
      const result = await client.query<AppliedMigration>("select version,filename from schema_migrations order by version");
      const applied = new Map(result.rows.map((row) => [row.version, row.filename]));
      const missing = [...expected].filter(([version]) => !applied.has(version)).map(([version, filename]) => ({ version, filename }));
      const mismatched = [...expected].filter(([version, filename]) => applied.has(version) && applied.get(version) !== filename)
        .map(([version, filename]) => ({ version, expected: filename, actual: applied.get(version) }));
      const unexpected = [...applied].filter(([version]) => !expected.has(version)).map(([version, filename]) => ({ version, filename }));
      const identity = await client.query<{
        database_name: string;
        connected_role: string;
        server_port: number | null;
        server_version: string;
        tls_enabled: boolean | null;
      }>(`select current_database() as database_name,
                 current_user as connected_role,
                 inet_server_port() as server_port,
                 current_setting('server_version') as server_version,
                 (select ssl from pg_stat_ssl where pid = pg_backend_pid()) as tls_enabled`);
      const connection = identity.rows[0];
      const report = {
        endpoint: { ...sanitizedEndpoint(), database: connection?.database_name ?? null, role: connection?.connected_role ?? null },
        server: { port: connection?.server_port ?? null, version: connection?.server_version ?? null, tlsEnabled: connection?.tls_enabled ?? null },
        expectedCount: expected.size,
        appliedCount: applied.size,
        missing,
        mismatched,
        unexpected,
        pass: missing.length === 0 && mismatched.length === 0 && unexpected.length === 0,
        readOnly: true,
        note: "Endpoint hostname and database name do not independently prove cloud project/branch identity; verify provider project and branch in the provider console. Connection secrets are intentionally excluded.",
      };
      await client.query("rollback");
      console.log(JSON.stringify(report, null, 2));
      if (!report.pass) process.exitCode = 1;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
