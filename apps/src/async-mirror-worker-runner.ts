import { Pool, type PoolConfig } from "pg";
import type { Pool as PoolType } from "pg";
import { databaseTlsConfig } from "./database-tls.js";

export type GovernmentInboxWorkerEnvironment = {
  GOVERNMENT_INBOX_DATABASE_URL?: string;
  DATABASE_URL?: string;
  DATABASE_SSL?: "require" | "false";
  DATABASE_CA_CERT?: string;
};

export type GovernmentInboxWorkerPoolFactory = (config: PoolConfig) => PoolType;

/**
 * Creates a worker-only pool. There is deliberately no DATABASE_URL fallback.
 * Callers must run assertGovernmentInboxWorkerSchema before any queue operation.
 */
export function createGovernmentInboxWorkerPool(
  env: GovernmentInboxWorkerEnvironment = process.env,
  poolFactory: GovernmentInboxWorkerPoolFactory = (config) => new Pool(config),
): PoolType {
  const workerUrl = env.GOVERNMENT_INBOX_DATABASE_URL?.trim();
  if (!workerUrl) {
    throw new Error("GOVERNMENT_INBOX_DATABASE_URL_REQUIRED");
  }

  if (!hasExplicitDatabasePrincipal(workerUrl)) {
    throw new Error("GOVERNMENT_INBOX_DATABASE_PRINCIPAL_REQUIRED");
  }

  const applicationUrl = env.DATABASE_URL?.trim();
  if (applicationUrl && sameDatabasePrincipal(workerUrl, applicationUrl)) {
    throw new Error("GOVERNMENT_INBOX_DATABASE_PRINCIPAL_MUST_BE_DEDICATED");
  }

  const ssl = databaseTlsConfig(env.DATABASE_SSL, env.DATABASE_CA_CERT);
  return poolFactory({
    connectionString: workerUrl,
    max: 2,
    application_name: "rupaykg-government-inbox-worker",
    ...(ssl ? { ssl } : {}),
  });
}

function hasExplicitDatabasePrincipal(url: string): boolean {
  try {
    return decodeURIComponent(new URL(url).username).length > 0;
  } catch {
    return false;
  }
}

function sameDatabasePrincipal(left: string, right: string): boolean {
  try {
    const leftRole = decodeURIComponent(new URL(left).username);
    const rightRole = decodeURIComponent(new URL(right).username);
    // Missing or malformed identity is not proof of a distinct PostgreSQL role.
    // Compare role identity independent of password, endpoint aliases, ports,
    // or database path: those are not proof of a separate database principal.
    return !leftRole || !rightRole || leftRole === rightRole;
  } catch {
    // Fail closed: malformed URLs cannot establish distinct principals.
    return true;
  }
}


export type WorkerPrincipalAttestation = {
  role_name: string;
  can_login: boolean;
  is_superuser: boolean;
  can_create_database: boolean;
  can_create_role: boolean;
  can_replicate: boolean;
  bypasses_rls: boolean;
  inherits_privileges: boolean;
  has_role_memberships: boolean;
  owns_worker_tables: boolean;
  owns_public_schema: boolean;
  has_public_schema_create: boolean;
  inbox_select: boolean;
  inbox_update: boolean;
  crosswalk_select: boolean;
  source_snapshot_select: boolean;
  activity_select: boolean;
  geography_scope_execute: boolean;
  source_scope_execute: boolean;
  event_table_select: boolean;
  event_table_insert: boolean;
  event_table_update: boolean;
  event_table_delete: boolean;
};

/**
 * Read-only least-privilege attestation for the connected worker principal.
 * The worker must not inherit application/owner capabilities or own queue
 * objects. It may read the scoped reference tables and update the inbox, but
 * cannot directly read or mutate the append-only event table.
 */
export async function assertGovernmentInboxWorkerPrincipal(
  pool: PoolType,
  applicationDatabaseUrl?: string,
): Promise<void> {
  let applicationRole: string | null = null;
  if (applicationDatabaseUrl?.trim()) {
    try {
      applicationRole = decodeURIComponent(new URL(applicationDatabaseUrl).username);
    } catch {
      throw new Error("GOVERNMENT_INBOX_APPLICATION_PRINCIPAL_INVALID");
    }
    if (!applicationRole) throw new Error("GOVERNMENT_INBOX_APPLICATION_PRINCIPAL_INVALID");
  }

  const result = await pool.query<WorkerPrincipalAttestation>(
    `select
       r.rolname as role_name,
       r.rolcanlogin as can_login,
       r.rolsuper as is_superuser,
       r.rolcreatedb as can_create_database,
       r.rolcreaterole as can_create_role,
       r.rolreplication as can_replicate,
       r.rolbypassrls as bypasses_rls,
       r.rolinherit as inherits_privileges,
       exists (select 1 from pg_auth_members m where m.member=r.oid) as has_role_memberships,
       exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public'
           and c.relname in ('async_mirror_inbox','async_mirror_inbox_events',
             'government_jurisdiction_crosswalks','authoritative_source_snapshots','activities')
           and c.relowner=r.oid
       ) as owns_worker_tables,
       exists (select 1 from pg_namespace n where n.nspname='public' and n.nspowner=r.oid) as owns_public_schema,
       has_schema_privilege(r.oid, 'public', 'CREATE') as has_public_schema_create,
       has_table_privilege(r.oid, 'public.async_mirror_inbox', 'SELECT') as inbox_select,
       has_table_privilege(r.oid, 'public.async_mirror_inbox', 'UPDATE') as inbox_update,
       has_table_privilege(r.oid, 'public.government_jurisdiction_crosswalks', 'SELECT') as crosswalk_select,
       has_table_privilege(r.oid, 'public.authoritative_source_snapshots', 'SELECT') as source_snapshot_select,
       has_table_privilege(r.oid, 'public.activities', 'SELECT') as activity_select,
       has_function_privilege(r.oid, 'public.organization_has_explicit_geography_scope(uuid,uuid)', 'EXECUTE') as geography_scope_execute,
       has_function_privilege(r.oid, 'public.government_source_scope_covers_geography(uuid,uuid)', 'EXECUTE') as source_scope_execute,
       has_table_privilege(r.oid, 'public.async_mirror_inbox_events', 'SELECT') as event_table_select,
       has_table_privilege(r.oid, 'public.async_mirror_inbox_events', 'INSERT') as event_table_insert,
       has_table_privilege(r.oid, 'public.async_mirror_inbox_events', 'UPDATE') as event_table_update,
       has_table_privilege(r.oid, 'public.async_mirror_inbox_events', 'DELETE') as event_table_delete
      from pg_roles r where r.rolname=current_user`,
  );
  const role = result.rows[0];
  if (!role) throw new Error("GOVERNMENT_INBOX_WORKER_PRINCIPAL_NOT_FOUND");

  const violations: string[] = [];
  if (!role.can_login) violations.push("LOGIN_REQUIRED");
  if (role.is_superuser) violations.push("SUPERUSER");
  if (role.can_create_database) violations.push("CREATEDB");
  if (role.can_create_role) violations.push("CREATEROLE");
  if (role.can_replicate) violations.push("REPLICATION");
  if (role.bypasses_rls) violations.push("BYPASSRLS");
  if (role.inherits_privileges) violations.push("INHERIT");
  if (role.has_role_memberships) violations.push("ROLE_MEMBERSHIP");
  if (role.owns_worker_tables) violations.push("WORKER_TABLE_OWNERSHIP");
  if (role.owns_public_schema) violations.push("PUBLIC_SCHEMA_OWNERSHIP");
  if (role.has_public_schema_create) violations.push("PUBLIC_SCHEMA_CREATE");
  if (!role.inbox_select) violations.push("INBOX_SELECT_MISSING");
  if (!role.inbox_update) violations.push("INBOX_UPDATE_MISSING");
  if (!role.crosswalk_select) violations.push("CROSSWALK_SELECT_MISSING");
  if (!role.source_snapshot_select) violations.push("SOURCE_SNAPSHOT_SELECT_MISSING");
  if (!role.activity_select) violations.push("ACTIVITY_SELECT_MISSING");
  if (!role.geography_scope_execute) violations.push("GEOGRAPHY_SCOPE_EXECUTE_MISSING");
  if (!role.source_scope_execute) violations.push("SOURCE_SCOPE_EXECUTE_MISSING");
  if (role.event_table_select || role.event_table_insert || role.event_table_update || role.event_table_delete) {
    violations.push("EVENT_TABLE_DIRECT_ACCESS");
  }
  if (applicationRole && role.role_name === applicationRole) {
    violations.push("APPLICATION_ROLE_REUSE");
  }

  if (violations.length) {
    throw new Error(`GOVERNMENT_INBOX_WORKER_PRINCIPAL_NOT_LEAST_PRIVILEGE: ${violations.join(",")}`);
  }
}


/** Run both read-only gates in order before the worker claims or mutates queue rows. */
export async function assertGovernmentInboxWorkerReady(
  pool: PoolType,
  applicationDatabaseUrl?: string,
): Promise<void> {
  await assertGovernmentInboxWorkerSchema(pool);
  await assertGovernmentInboxWorkerPrincipal(pool, applicationDatabaseUrl);
}

type WorkerSchemaReadiness = {
  inbox_table: string | null;
  inbox_events_table: string | null;
  crosswalk_table: string | null;
  source_snapshot_table: string | null;
  explicit_geography_scope_function: string | null;
  source_scope_geography_function: string | null;
  unresolved_status_supported: boolean;
  inbox_event_trigger_present: boolean;
};

/**
 * Read-only schema gate. It fails closed before queue state can be changed.
 * This verifies required objects only; it does not establish role privileges,
 * data approvals, source authority, or deployment readiness.
 */
export async function assertGovernmentInboxWorkerSchema(pool: PoolType): Promise<void> {
  const result = await pool.query<WorkerSchemaReadiness>(
    `select
       to_regclass('public.async_mirror_inbox')::text as inbox_table,
       to_regclass('public.async_mirror_inbox_events')::text as inbox_events_table,
       to_regclass('public.government_jurisdiction_crosswalks')::text as crosswalk_table,
       to_regclass('public.authoritative_source_snapshots')::text as source_snapshot_table,
       to_regprocedure('public.organization_has_explicit_geography_scope(uuid,uuid)')::text as explicit_geography_scope_function,
       to_regprocedure('public.government_source_scope_covers_geography(uuid,uuid)')::text as source_scope_geography_function,
       exists (
         select 1 from pg_constraint
          where conrelid=to_regclass('public.async_mirror_inbox')
            and contype='c'
            and pg_get_constraintdef(oid) ilike '%UNRESOLVED%'
       ) as unresolved_status_supported,
       exists (
         select 1 from pg_trigger
          where tgrelid=to_regclass('public.async_mirror_inbox')
            and not tgisinternal
            and tgname='async_mirror_inbox_event_after_change'
       ) as inbox_event_trigger_present`,
  );

  const schema = result.rows[0];
  if (!schema) throw new Error("GOVERNMENT_INBOX_SCHEMA_READINESS_QUERY_EMPTY");

  const missing: string[] = [];
  if (!schema.inbox_table) missing.push("async_mirror_inbox");
  if (!schema.inbox_events_table) missing.push("async_mirror_inbox_events");
  if (!schema.crosswalk_table) missing.push("government_jurisdiction_crosswalks");
  if (!schema.source_snapshot_table) missing.push("authoritative_source_snapshots");
  if (!schema.explicit_geography_scope_function) missing.push("organization_has_explicit_geography_scope(uuid,uuid)");
  if (!schema.source_scope_geography_function) missing.push("government_source_scope_covers_geography(uuid,uuid)");
  if (!schema.unresolved_status_supported) missing.push("async_mirror_inbox status constraint UNRESOLVED");
  if (!schema.inbox_event_trigger_present) missing.push("async_mirror_inbox_event_after_change trigger");

  if (missing.length) {
    throw new Error(`GOVERNMENT_INBOX_SCHEMA_NOT_READY: ${missing.join(", ")}`);
  }
}
