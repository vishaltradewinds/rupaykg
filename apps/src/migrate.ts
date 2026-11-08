import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});

try {
  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      filename text not null,
      applied_at timestamptz not null default now(),
      checksum text
    )
  `);

  await pool.query("alter table schema_migrations add column if not exists checksum text");
  // Existing rows created before checksum enforcement are backfilled once; subsequent
  // runs fail closed if an already-applied migration's content changes.

  // Support both CI/source execution (/repo/apps/src) and the production
  // container (/app/apps/dist/src). Never assume a single filesystem root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  const migrationDir = candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);
  const files = (await readdir(migrationDir))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  const prefixCounts = new Map<string, number>();
  for (const filename of files) {
    const prefix = filename.match(/^(\d+)_/)?.[1] ?? "";
    if (!prefix) throw new Error(`Invalid migration filename: ${filename}`);
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
  }

  for (const filename of files) {
    const prefix = filename.match(/^(\d+)_/)?.[1] ?? "";
    if (!prefix) throw new Error(`Invalid migration filename: ${filename}`);
    const version = (prefixCounts.get(prefix) ?? 0) > 1 ? filename.replace(/\.sql$/, "") : prefix;
    const sql = await readFile(path.join(migrationDir, filename), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await pool.query<{ version: string; filename: string; checksum: string | null }>(
      "select version, filename, checksum from schema_migrations where version = $1",
      [version],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].filename !== filename) {
        throw new Error(`Migration version ${version} is already recorded as ${existing.rows[0].filename}, not ${filename}`);
      }
      if (existing.rows[0].checksum && existing.rows[0].checksum !== checksum) {
        throw new Error(`Migration ${filename} checksum mismatch: applied content has changed`);
      }
      if (!existing.rows[0].checksum) {
        await pool.query("update schema_migrations set checksum = $2 where version = $1 and checksum is null", [version, checksum]);
      }
      continue;
    }

    const protectedMigration = /^(?:20261107_(authority_hierarchy_context|context_identity_bootstrap|platform_execution_context|runtime_grant_reconciliation|context_organization_id|core_tenant_rls_activation_gate)|20261108_context_identity_liveness_(hardening|completion)|088_field_sync_append_only_integrity|082_settlement_reference_trigger_insert_safety|089_settlement_reconciliation_reference_integrity|090_runtime_dml_grant_reconciliation_completion|091_settlement_tenant_rls|092_settlement_lifecycle_transition_integrity|093_registry_event_tenant_rls|094_registry_event_identity_write_authority|095_credentials_tenant_rls|096_credential_authority_field_immutability|097_field_sync_tenant_rls)\.sql$/.test(filename);
    if (protectedMigration && process.env.RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS !== "1") {
      throw new Error(`Protected Shakti migration ${filename} requires explicit RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS=1`);
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into schema_migrations(version, filename, checksum) values ($1, $2, $3)",
        [version, filename, checksum],
      );
      await client.query("commit");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migration ${filename} failed`, { cause: error });
    } finally {
      client.release();
    }
  }

  console.log(`Database migrations are current (${files.length} files).`);
} finally {
  await pool.end();
}
