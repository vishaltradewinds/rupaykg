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
  "evidence_artifact_series",
  "evidence_artifact_versions",
  "evidence_artifact_reviews",
  "field_sync_envelopes",
  "field_sync_cursors",
  "field_sync_conflicts",
  "mrv_provenance_events",
  "organization_geography_scopes",
  "registry_events",
  "settlement_events",
  "environmental_attribute_claims",
];

const securityDefinerFunctions = [
  "set_request_context",
  "is_verified_org_member",
  "authenticate_bearer_session",
  "current_identity_id",
  "current_organization_id",
  "current_credential_owner_id",
  "organization_has_verified_members",
  "is_verified_organization",
  "activity_belongs_to_organization",
  "activity_has_verified_geography_scope",
  "credential_has_verified_mrv_provenance",
  "credential_is_acceptance_fixture",
  "review_authority_allowed",
  "onboarding_review_queue",
  "onboarding_verify_legal",
  "onboarding_decide",
];

const connectionUrl = new URL(databaseUrl);
// The runtime supplies TLS policy explicitly through the ssl option below.
// Remove sslmode from the libpq URL so node-postgres does not emit a conflicting
// SSL configuration warning when both mechanisms are present.
connectionUrl.searchParams.delete("sslmode");

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: process.env.DATABASE_SSL === "require"
    ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
    : { rejectUnauthorized: false },
  max: 1,
});

const client = await pool.connect();
let transactionOpen = false;
try {
  // Keep every check on one connection. The login is intentionally allowed to
  // SET ROLE into rupaykg_app_runtime without inheriting its privileges; therefore
  // function/table checks must run after the explicit role hand-off.
  await client.query("begin read only");
  transactionOpen = true;

  const login = await client.query<{
    session_user: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
  }>(
    `select session_user,
            r.rolsuper,
            r.rolbypassrls
       from pg_roles r
      where r.rolname = session_user`,
  );
  const loginRole = login.rows[0];
  if (!loginRole || loginRole.rolsuper || loginRole.rolbypassrls) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: database login must be non-superuser and NOBYPASSRLS; session_user=${loginRole?.session_user ?? "unknown"} superuser=${loginRole?.rolsuper ?? "unknown"} bypassrls=${loginRole?.rolbypassrls ?? "unknown"}`,
    );
  }

  await client.query("set local role rupaykg_app_runtime");
  const runtime = await client.query<{
    current_user: string;
    rolcanlogin: boolean;
    rolsuper: boolean;
    rolbypassrls: boolean;
  }>(
    `select current_user,
            r.rolcanlogin,
            r.rolsuper,
            r.rolbypassrls
       from pg_roles r
      where r.rolname = current_user`,
  );
  const runtimeRole = runtime.rows[0];
  if (
    !runtimeRole ||
    runtimeRole.current_user !== "rupaykg_app_runtime" ||
    runtimeRole.rolcanlogin ||
    runtimeRole.rolsuper ||
    runtimeRole.rolbypassrls
  ) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: SET ROLE must enter the dedicated NOLOGIN, non-superuser, NOBYPASSRLS role; current_user=${runtimeRole?.current_user ?? "unknown"} login=${runtimeRole?.rolcanlogin ?? "unknown"} superuser=${runtimeRole?.rolsuper ?? "unknown"} bypassrls=${runtimeRole?.rolbypassrls ?? "unknown"}`,
    );
  }

  const ownership = await client.query<{
    table_name: string;
    owner: string;
    rls_enabled: boolean;
    rls_forced: boolean;
  }>(
    `select c.relname as table_name,
            pg_get_userbyid(c.relowner) as owner,
            c.relrowsecurity as rls_enabled,
            c.relforcerowsecurity as rls_forced
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

  const unsafe = ownership.rows.filter(
    row => row.owner === runtimeRole.current_user || !row.rls_enabled || !row.rls_forced,
  );
  if (unsafe.length) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: protected tables must be separate from the runtime role and have RLS plus FORCE RLS: ${unsafe.map(row => `${row.table_name}(owner=${row.owner},rls=${row.rls_enabled},force=${row.rls_forced})`).join(", ")}`,
    );
  }

  const functionPrivileges = await client.query<{
    function_name: string;
    function_owner: string;
    runtime_execute: boolean;
    public_execute: boolean;
    security_definer: boolean;
    hardened_search_path: boolean;
  }>(
    `select p.proname as function_name,
            pg_get_userbyid(p.proowner) as function_owner,
            has_function_privilege(current_user, p.oid, 'EXECUTE') as runtime_execute,
            has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
            p.prosecdef as security_definer,
            coalesce(p.proconfig::text, '') like '%search_path=pg_catalog, public, app%' as hardened_search_path
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app'
        and p.proname = any($1::text[])
      order by p.proname`,
    [securityDefinerFunctions],
  );

  if (
    functionPrivileges.rows.length !== securityDefinerFunctions.length ||
    functionPrivileges.rows.some(
      row =>
        row.function_owner !== "rupaykg_security_definer" ||
        !row.runtime_execute ||
        row.public_execute ||
        !row.security_definer ||
        !row.hardened_search_path,
    )
  ) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: SECURITY DEFINER boundary is invalid: ${JSON.stringify(functionPrivileges.rows)}`,
    );
  }

  const ownerBoundary = await client.query<{
    owner_exists: boolean;
    owner_safe: boolean;
    runtime_can_assume_owner: boolean;
    runtime_login_can_set_owner: boolean;
    owner_has_unsafe_memberships: boolean;
  }>(
    `select
       exists (select 1 from pg_roles where rolname = 'rupaykg_security_definer') as owner_exists,
       coalesce((
         select not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
                and not rolcreatedb and not rolcreaterole and not rolreplication
           from pg_roles where rolname = 'rupaykg_security_definer'
       ), false) as owner_safe,
       pg_has_role('rupaykg_app_runtime', 'rupaykg_security_definer', 'MEMBER') as runtime_can_assume_owner,
       pg_has_role(session_user, 'rupaykg_security_definer', 'SET') as runtime_login_can_set_owner,
       exists (
         select 1
           from pg_auth_members membership
           left join pg_roles member_role on member_role.oid = membership.member
          where membership.member = 'rupaykg_security_definer'::regrole
             or (
               membership.roleid = 'rupaykg_security_definer'::regrole
               and not (
                 member_role.rolname = 'rupaykg'
                 and pg_get_userbyid(membership.grantor) = 'cloud_admin'
                 and membership.admin_option
                 and not membership.inherit_option
                 and not membership.set_option
               )
             )
       ) as owner_has_unsafe_memberships`,
  );
  const boundary = ownerBoundary.rows[0];
  if (
    !boundary?.owner_exists ||
    !boundary.owner_safe ||
    boundary.runtime_can_assume_owner ||
    boundary.runtime_login_can_set_owner ||
    boundary.owner_has_unsafe_memberships
  ) {
    throw new Error(
      `RUPAYKG_RUNTIME_DB_PREFLIGHT_FAILED: isolated SECURITY DEFINER owner role is unsafe: ${JSON.stringify(boundary)}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    database_login: loginRole.session_user,
    effective_runtime_role: runtimeRole.current_user,
    login_superuser: loginRole.rolsuper,
    login_bypassrls: loginRole.rolbypassrls,
    protected_tables: protectedTables.length,
    rls_enabled_and_forced: true,
    runtime_role_separated_from_table_owners: true,
    security_definer_functions: securityDefinerFunctions.length,
    security_definer_owner: "PASS",
  }));

  await client.query("rollback");
  transactionOpen = false;
} finally {
  if (transactionOpen) {
    try { await client.query("rollback"); } catch {}
  }
  client.release();
  await pool.end();
}
