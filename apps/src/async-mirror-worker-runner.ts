import { Pool, type PoolConfig } from "pg";
import type { Pool as PoolType } from "pg";

export type GovernmentInboxWorkerEnvironment = {
  GOVERNMENT_INBOX_DATABASE_URL?: string;
  DATABASE_URL?: string;
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

  const applicationUrl = env.DATABASE_URL?.trim();
  if (applicationUrl && sameDatabasePrincipal(workerUrl, applicationUrl)) {
    throw new Error("GOVERNMENT_INBOX_DATABASE_PRINCIPAL_MUST_BE_DEDICATED");
  }

  return poolFactory({ connectionString: workerUrl, max: 2, application_name: "rupaykg-government-inbox-worker" });
}

function sameDatabasePrincipal(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.protocol === b.protocol
      && a.hostname === b.hostname
      && a.port === b.port
      && a.pathname === b.pathname
      && a.pathname === b.pathname
      // PostgreSQL principal identity is the role name, not the password.
      // A rotated password must never make the same role look dedicated.
      && decodeURIComponent(a.username) === decodeURIComponent(b.username);
  } catch {
    // Invalid URLs are rejected by pg on connection; never treat malformed
    // values as proof that the worker principal is distinct.
    return left === right;
  }
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
