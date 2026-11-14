import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// This runner is deliberately separate from application startup. It requires
// Date-prefixed controlled migrations stay outside the numeric baseline validator.
// the database-owner migration connection and applies Shakti migrations 101-20261114
// as one atomic transaction so the application never sees a partial RLS state.
const databaseUrl = process.env.MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL is required; do not use the application runtime connection for schema migrations");

const ddlRole = process.env.RUPAYKG_MIGRATION_DDL_ROLE ?? "rupaykg_ddl";
const securityDefinerRole = "rupaykg_security_definer";
if (!/^[a-z_][a-z0-9_]*$/.test(ddlRole)) throw new Error("RUPAYKG_MIGRATION_DDL_ROLE must be a plain PostgreSQL role identifier");

const tenantDomainTables = [
  "bwg_profiles",
  "bwg_reporting_periods",
  "carbon_projects",
  "cpcb_swm_stakeholder_workspaces",
  "cpcb_swm_status_history",
  "epr_returns",
  "esg_reporting_periods",
  "organization_bwg_assessments",
  "organization_epr_applicability",
  "organization_statutory_profiles",
  "organization_verification_evidence",
  "stakeholder_applications",
  "stakeholder_application_approvals",
] as const;

const controlledMigrationOrder = [
  "101_shakti_tenant_isolation_activation.sql",
  "102_shakti_runtime_auth_handoff.sql",
  "103_shakti_nonforgeable_request_context.sql",
  "104_shakti_isolated_security_definer_owner.sql",
  // This date-prefixed file is logical migration 105; keep it before 106/107.
  "20261113_shakti_field_sync_evidence_mrv_rls.sql",
  "106_credential_lifecycle_verification_boundary.sql",
  "107_shakti_tenant_direct_domain_activation.sql",
  "108_shakti_tenant_organization_domain_activation.sql",
  "20261114_shakti_platform_review_boundary.sql",
];

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});

try {
  const identity = await pool.query<{ session_user: string; current_user: string }>(
    "select session_user, current_user",
  );
  if (identity.rows[0]?.session_user !== identity.rows[0]?.current_user) {
    throw new Error("Controlled Shakti migrations must connect directly as the database-owner login, not through SET ROLE");
  }

  const roleCheck = await pool.query<{ ddl_exists: boolean; owner_exists: boolean; runtime_safe: boolean }>(
    `select
       exists(select 1 from pg_roles where rolname=$1 and not rolcanlogin and not rolsuper and not rolbypassrls) as ddl_exists,
       exists(select 1 from pg_roles where rolname=$2 and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit and not rolcreatedb and not rolcreaterole and not rolreplication) as owner_exists,
       exists(select 1 from pg_roles where rolname='rupaykg_app_runtime' and not rolcanlogin and not rolsuper and not rolbypassrls) as runtime_safe`,
    [ddlRole, securityDefinerRole],
  );
  if (!roleCheck.rows[0]?.ddl_exists) throw new Error(`Required NOLOGIN DDL role is missing: ${ddlRole}. Run the controlled DBA ownership bootstrap first.`);
  if (!roleCheck.rows[0]?.owner_exists) throw new Error(`Required isolated SECURITY DEFINER role is missing or unsafe: ${securityDefinerRole}`);
  if (!roleCheck.rows[0]?.runtime_safe) throw new Error("Application runtime role is missing or unsafe");

  const ledger = await pool.query<{ ledger: string | null }>(
    "select to_regclass('public.schema_migrations')::text as ledger",
  );
  if (!ledger.rows[0]?.ledger) throw new Error("schema_migrations ledger is missing; run the baseline migration runner first");

  const baseline = await pool.query(
    "select 1 from public.schema_migrations where filename='100_shakti_production_ddl_runtime_role_split.sql'",
  );
  if (!baseline.rowCount) throw new Error("Baseline migration 100 is not recorded; refusing controlled RLS activation");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  const migrationDir = candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);

  const availableFiles = new Set(await readdir(migrationDir));
  const missing = controlledMigrationOrder.filter((name) => !availableFiles.has(name));
  if (missing.length) throw new Error(`Controlled Shakti migration set is incomplete: ${missing.join(", ")}`);

  // The two date-prefixed files are logical migrations 105 and 109.
  // Never derive ledger versions from their calendar-date filename prefix.
  const logicalVersionByFilename: Record<string, string> = {
    "20261113_shakti_field_sync_evidence_mrv_rls.sql": "105",
    "20261114_shakti_platform_review_boundary.sql": "109",
  };
  const versions = controlledMigrationOrder.map((filename) => ({
    filename,
    version: logicalVersionByFilename[filename] ?? filename.slice(0, filename.indexOf("_")),
  }));
  const existingRows = await pool.query<{ version: string; filename: string }>(
    "select version, filename from public.schema_migrations where version = any($1::text[])",
    [versions.map((entry) => entry.version)],
  );
  const existing = new Map(existingRows.rows.map((row) => [row.version, row.filename]));
  for (const entry of versions) {
    const recorded = existing.get(entry.version);
    if (recorded && recorded !== entry.filename) {
      throw new Error(`Migration version ${entry.version} is already recorded as ${recorded}, not ${entry.filename}`);
    }
  }
  if (existing.size === versions.length) {
    console.log(`Controlled Shakti migrations current (${versions.length} files).`);
    process.exitCode = 0;
  } else if (existing.size > 0) {
    throw new Error("Partial Shakti migration ledger detected. Refusing to mix old and new migration execution paths; reconcile the ledger before retrying.");
  } else {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local lock_timeout = '5s'");
      await client.query("set local statement_timeout = '180s'");

      // These schema and catalogue grants belong to the database owner, not
      // the DDL role. They are in the same transaction as RLS activation.
      await client.query(`grant usage on schema app, public to ${securityDefinerRole}`);
      await client.query(`grant create on schema app to ${securityDefinerRole}`);
      await client.query("grant select on public.geography, public.methodology_versions to rupaykg_app_runtime");

      // The organization-owned domain tables were introduced after the
      // original migration-100 ownership split. Transfer them to the controlled
      // NOLOGIN DDL role in this same transaction, refusing unexpected owners.
      for (const tableName of tenantDomainTables) {
        const ownerResult = await client.query<{ owner: string | null }>(
          `select pg_get_userbyid(c.relowner) as owner
             from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relname=$1 and c.relkind='r'`,
          [tableName],
        );
        const owner = ownerResult.rows[0]?.owner;
        if (!owner) throw new Error(`Tenant domain table is missing: public.${tableName}`);
        if (owner === identity.rows[0]?.session_user) {
          await client.query(`alter table public.${tableName} owner to ${ddlRole}`);
        } else if (owner !== ddlRole) {
          throw new Error(`Unexpected owner for public.${tableName}: ${owner}`);
        }
      }

      // Temporarily inherit the isolated function-owner privileges so the DDL
      // role can replace its functions. Both changes are rolled back on failure.
      await client.query(`alter role ${ddlRole} inherit`);
      await client.query(`grant ${securityDefinerRole} to ${ddlRole}`);
      await client.query(`set local role ${ddlRole}`);

      for (const filename of controlledMigrationOrder) {
        const sql = await readFile(path.join(migrationDir, filename), "utf8");
        await client.query(sql);
        console.log(`Executed controlled migration ${filename}`);
      }

      await client.query("reset role");
      await client.query(`revoke ${securityDefinerRole} from ${ddlRole}`);
      await client.query(`alter role ${ddlRole} noinherit`);
      await client.query(`revoke create on schema app from ${securityDefinerRole}`);
      await client.query(`comment on role ${securityDefinerRole} is 'NOLOGIN/NOBYPASSRLS isolated owner for narrowly scoped SECURITY DEFINER functions; no application runtime membership.'`);

      for (const entry of versions) {
        await client.query(
          "insert into public.schema_migrations(version, filename) values ($1, $2)",
          [entry.version, entry.filename],
        );
      }
      await client.query("commit");
      console.log(`Applied all ${versions.length} controlled Shakti migrations atomically.`);
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw new Error("Controlled Shakti migration batch failed; all migration, ledger, and temporary privilege changes rolled back", { cause: error });
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
