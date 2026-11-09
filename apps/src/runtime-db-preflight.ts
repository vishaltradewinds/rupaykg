import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: DATABASE_URL is required");
}

const protectedTables = [
  "organizations",
  "roles",
  "activities",
  "obligations",
  "credentials",
  "settlements",
  "audit_events",
  "resource_flows",
  "field_devices",
  "organization_memberships",
  "measurements",
  "evidence",
  "verifications",
  "carbon_calculations",
  "mrv_observations",
  "evidence_verification_requirements",
  "chain_of_custody_links",
];

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "require"
    ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
    : { rejectUnauthorized: false },
  max: 1,
});

try {
  const identity = await pool.query<{
    current_user: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
  }>(
    `select current_user,
            r.rolsuper,
            r.rolbypassrls
       from pg_roles r
      where r.rolname = current_user`,
  );

  const role = identity.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: application DB role must be non-superuser and NOBYPASSRLS; current_user=${role?.current_user ?? "unknown"} superuser=${role?.rolsuper ?? "unknown"} bypassrls=${role?.rolbypassrls ?? "unknown"}`,
    );
  }

  const ownership = await pool.query<{ table_name: string; owner: string; rls_enabled: boolean }>(
    `select c.relname as table_name,
            pg_get_userbyid(c.relowner) as owner,
            c.relrowsecurity as rls_enabled
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = any($1::text[])
      order by c.relname`,
    [protectedTables],
  );

  if (ownership.rows.length !== protectedTables.length) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: protected-table coverage mismatch; expected=${protectedTables.length} actual=${ownership.rows.length}`,
    );
  }

  const unsafe = ownership.rows.filter(row => row.owner === role.current_user || !row.rls_enabled);
  if (unsafe.length) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: protected tables are not safely separated from runtime role or RLS is disabled: ${unsafe.map(row => `${row.table_name}(owner=${row.owner},rls=${row.rls_enabled})`).join(", ")}`,
    );
  }

  const functionPrivileges = await pool.query<{
    function_name: string;
    runtime_execute: boolean;
    public_execute: boolean;
    security_definer: boolean;
    hardened_search_path: boolean;
  }>(
    `select p.proname as function_name,
            has_function_privilege(current_user, p.oid, 'EXECUTE') as runtime_execute,
            has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
            p.prosecdef as security_definer,
            coalesce(p.proconfig::text, '') like '%search_path=pg_catalog, public, app%' as hardened_search_path
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app'
        and p.proname = any($1::text[])
      order by p.proname`,
    [["set_request_context", "is_verified_org_member", "authenticate_bearer_session"]],
  );

  if (
    functionPrivileges.rows.length !== 3 ||
    functionPrivileges.rows.some(
      row => !row.runtime_execute || row.public_execute || !row.security_definer || !row.hardened_search_path,
    )
  ) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: SECURITY DEFINER boundary is invalid: ${JSON.stringify(functionPrivileges.rows)}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    current_user: role.current_user,
    superuser: role.rolsuper,
    bypassrls: role.rolbypassrls,
    protected_tables: protectedTables.length,
    rls_enabled: true,
    runtime_role_separated_from_table_owners: true,
    security_definer_boundary: "PASS",
  }));
} finally {
  await pool.end();
}
