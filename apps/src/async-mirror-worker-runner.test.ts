import test from "node:test";
import assert from "node:assert/strict";
import type { Pool, PoolConfig } from "pg";
import {
  assertGovernmentInboxWorkerSchema,
  assertGovernmentInboxWorkerPrincipal,
  assertGovernmentInboxWorkerReady,
  createGovernmentInboxWorkerPool,
  type GovernmentInboxWorkerPoolFactory,
} from "./async-mirror-worker-runner.js";

test("worker pool requires the dedicated URL and never falls back to DATABASE_URL", () => {
  assert.throws(
    () => createGovernmentInboxWorkerPool({ DATABASE_URL: "postgres://app:secret@db.example/rupaykg" }),
    /GOVERNMENT_INBOX_DATABASE_URL_REQUIRED/,
  );
});

test("worker pool rejects reusing the application database principal", () => {
  const url = "postgres://app:secret@db.example/rupaykg";
  assert.throws(
    () => createGovernmentInboxWorkerPool({ DATABASE_URL: url, GOVERNMENT_INBOX_DATABASE_URL: url }),
    /GOVERNMENT_INBOX_DATABASE_PRINCIPAL_MUST_BE_DEDICATED/,
  );
});

test("worker pool uses only the dedicated URL and a bounded connection pool", () => {
  let captured: PoolConfig | undefined;
  const fakePool = {} as Pool;
  const factory: GovernmentInboxWorkerPoolFactory = (config) => {
    captured = config;
    return fakePool;
  };
  const pool = createGovernmentInboxWorkerPool({
    DATABASE_URL: "postgres://web:secret@db.example/rupaykg",
    GOVERNMENT_INBOX_DATABASE_URL: "postgres://worker:other@db.example/rupaykg",
  }, factory);

  assert.equal(pool, fakePool);
  assert.equal(captured?.connectionString, "postgres://worker:other@db.example/rupaykg");
  assert.equal(captured?.max, 2);
  assert.equal(captured?.application_name, "rupaykg-government-inbox-worker");
  assert.deepEqual(captured?.ssl, { rejectUnauthorized: true }, "worker TLS must verify the server certificate by default");
});

function schemaPool(row: Record<string, unknown>): Pool {
  return {
    query: async (sql: string) => {
      assert.match(sql, /to_regclass\('public\.async_mirror_inbox'\)/);
      assert.match(sql, /to_regprocedure\('public\.government_source_scope_covers_geography/);
      assert.doesNotMatch(sql, /\b(update|insert|delete|truncate|alter)\b/i);
      return { rows: [row], rowCount: 1 };
    },
  } as unknown as Pool;
}

const readySchema = {
  inbox_table: "async_mirror_inbox",
  inbox_events_table: "async_mirror_inbox_events",
  crosswalk_table: "government_jurisdiction_crosswalks",
  source_snapshot_table: "authoritative_source_snapshots",
  explicit_geography_scope_function: "organization_has_explicit_geography_scope(uuid,uuid)",
  source_scope_geography_function: "government_source_scope_covers_geography(uuid,uuid)",
  unresolved_status_supported: true,
  inbox_event_trigger_present: true,
};

test("schema readiness passes only when every worker dependency exists", async () => {
  await assert.doesNotReject(() => assertGovernmentInboxWorkerSchema(schemaPool(readySchema)));
});

test("schema readiness fails closed when live schema is missing crosswalk and unresolved support", async () => {
  const incomplete = {
    ...readySchema,
    crosswalk_table: null,
    source_snapshot_table: null,
    source_scope_geography_function: null,
    unresolved_status_supported: false,
  };
  await assert.rejects(
    () => assertGovernmentInboxWorkerSchema(schemaPool(incomplete)),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /GOVERNMENT_INBOX_SCHEMA_NOT_READY/);
      assert.match(error.message, /government_jurisdiction_crosswalks/);
      assert.match(error.message, /UNRESOLVED/);
      return true;
    },
  );
});

test("schema readiness fails closed on an empty catalog response", async () => {
  const pool = {
    query: async () => ({ rows: [], rowCount: 0 }),
  } as unknown as Pool;
  await assert.rejects(
    () => assertGovernmentInboxWorkerSchema(pool),
    /GOVERNMENT_INBOX_SCHEMA_READINESS_QUERY_EMPTY/,
  );
});


test("worker pool rejects the same database role even when its password differs", () => {
  assert.throws(
    () => createGovernmentInboxWorkerPool({
      DATABASE_URL: "postgres://shared_app:old-secret@db.example/rupaykg",
      GOVERNMENT_INBOX_DATABASE_URL: "postgres://shared_app:new-secret@db.example/rupaykg",
    }),
    /GOVERNMENT_INBOX_DATABASE_PRINCIPAL_MUST_BE_DEDICATED/,
  );
});

test("worker pool rejects URL-encoded variants of the same database role", () => {
  assert.throws(
    () => createGovernmentInboxWorkerPool({
      DATABASE_URL: "postgres://shared%5Fapp:old-secret@db.example/rupaykg",
      GOVERNMENT_INBOX_DATABASE_URL: "postgres://shared_app:new-secret@db.example/rupaykg",
    }),
    /GOVERNMENT_INBOX_DATABASE_PRINCIPAL_MUST_BE_DEDICATED/,
  );
});


test("worker pool rejects the same role across endpoint aliases and ports", () => {
  assert.throws(
    () => createGovernmentInboxWorkerPool({
      DATABASE_URL: "postgres://shared_app:old-secret@db-primary.example:5432/rupaykg",
      GOVERNMENT_INBOX_DATABASE_URL: "postgres://shared_app:new-secret@pooler.example:6432/otherdb",
    }),
    /GOVERNMENT_INBOX_DATABASE_PRINCIPAL_MUST_BE_DEDICATED/,
  );
});


test("worker database pool verifies TLS by default and accepts an explicit CA certificate", () => {
  let captured: PoolConfig | undefined;
  createGovernmentInboxWorkerPool({
    GOVERNMENT_INBOX_DATABASE_URL: "postgres://worker:secret@db.example/rupaykg",
    DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nTEST\\n-----END CERTIFICATE-----",
  }, (config) => {
    captured = config;
    return {} as Pool;
  });
  assert.deepEqual(captured?.ssl, {
    rejectUnauthorized: true,
    ca: "-----BEGIN CERTIFICATE-----\\nTEST\\n-----END CERTIFICATE-----",
  });
});

test("worker database pool only disables TLS when explicitly configured", () => {
  let captured: PoolConfig | undefined;
  createGovernmentInboxWorkerPool({
    GOVERNMENT_INBOX_DATABASE_URL: "postgres://worker:secret@db.example/rupaykg",
    DATABASE_SSL: "false",
  }, (config) => {
    captured = config;
    return {} as Pool;
  });
  assert.equal(captured?.ssl, undefined);
});


test("worker pool rejects a URL without an explicit PostgreSQL role name", () => {
  assert.throws(
    () => createGovernmentInboxWorkerPool({
      GOVERNMENT_INBOX_DATABASE_URL: "postgres://:secret@db.example/rupaykg",
    }),
    /GOVERNMENT_INBOX_DATABASE_PRINCIPAL_REQUIRED/,
  );
});

test("worker pool fails closed when the application role identity is malformed or missing", () => {
  for (const applicationUrl of ["not-a-postgres-url", "postgres://:secret@db.example/rupaykg"]) {
    assert.throws(
      () => createGovernmentInboxWorkerPool({
        DATABASE_URL: applicationUrl,
        GOVERNMENT_INBOX_DATABASE_URL: "postgres://worker:secret@db.example/rupaykg",
      }),
      /GOVERNMENT_INBOX_DATABASE_PRINCIPAL_MUST_BE_DEDICATED/,
    );
  }
});


const leastPrivilegePrincipal = {
  role_name: "rupaykg_inbox_worker",
  can_login: true,
  is_superuser: false,
  can_create_database: false,
  can_create_role: false,
  can_replicate: false,
  bypasses_rls: false,
  inherits_privileges: false,
  has_role_memberships: false,
  owns_worker_tables: false,
  owns_public_schema: false,
  has_public_schema_create: false,
  has_public_schema_usage: true,
  public_inbox_acl: false,
  public_reference_acl: false,
  public_scope_function_execute: false,
  inbox_select: true,
  inbox_insert: false,
  inbox_delete: false,
  inbox_table_update: false,
  inbox_update_status: true,
  inbox_update_attempts: true,
  inbox_update_lease_token: true,
  inbox_update_lease_until: true,
  inbox_update_quarantined_at: true,
  inbox_update_last_error_code: true,
  inbox_update_next_attempt_at: true,
  inbox_update_processed_at: true,
  inbox_update_validation_summary: true,
  crosswalk_select: true,
  source_snapshot_select: true,
  activity_select: true,
  geography_scope_execute: true,
  source_scope_execute: true,
  event_table_select: false,
  event_table_insert: false,
  event_table_update: false,
  event_table_delete: false,
};

function principalPool(row: Record<string, unknown>): Pool {
  return {
    query: async (sql: string) => {
      assert.match(sql, /from pg_roles r where r\.rolname=current_user/);
      assert.match(sql, /pg_auth_members/);
      assert.match(sql, /BYPASSRLS|rolbypassrls/);
      return { rows: [row], rowCount: 1 };
    },
  } as unknown as Pool;
}

test("worker principal attestation accepts a dedicated least-privilege role", async () => {
  await assert.doesNotReject(() => assertGovernmentInboxWorkerPrincipal(
    principalPool(leastPrivilegePrincipal),
    "postgres://web:secret@db.example/rupaykg",
  ));
});

test("worker principal attestation rejects elevated attributes, memberships, ownership and event-table access", async () => {
  const unsafe = {
    ...leastPrivilegePrincipal,
    can_create_role: true,
    bypasses_rls: true,
    has_role_memberships: true,
    owns_worker_tables: true,
    owns_public_schema: true,
    has_public_schema_create: true,
    has_public_schema_usage: false,
    public_inbox_acl: true,
    public_reference_acl: true,
    public_scope_function_execute: true,
    event_table_insert: true,
  };
  await assert.rejects(
    () => assertGovernmentInboxWorkerPrincipal(principalPool(unsafe)),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CREATEROLE/);
      assert.match(error.message, /BYPASSRLS/);
      assert.match(error.message, /ROLE_MEMBERSHIP/);
      assert.match(error.message, /WORKER_TABLE_OWNERSHIP/);
      assert.match(error.message, /PUBLIC_SCHEMA_OWNERSHIP/);
      assert.match(error.message, /PUBLIC_SCHEMA_CREATE/);
      assert.match(error.message, /PUBLIC_SCHEMA_USAGE_MISSING/);
      assert.match(error.message, /PUBLIC_INBOX_PRIVILEGE/);
      assert.match(error.message, /PUBLIC_REFERENCE_PRIVILEGE/);
      assert.match(error.message, /PUBLIC_SCOPE_FUNCTION_EXECUTE/);
      assert.match(error.message, /EVENT_TABLE_DIRECT_ACCESS/);
      return true;
    },
  );
});

test("worker principal attestation rejects missing operational grants", async () => {
  const incomplete = {
    ...leastPrivilegePrincipal,
    inbox_update_validation_summary: false,
    crosswalk_select: false,
    source_scope_execute: false,
  };
  await assert.rejects(
    () => assertGovernmentInboxWorkerPrincipal(principalPool(incomplete)),
    /INBOX_VALIDATION_SUMMARY_UPDATE_MISSING,CROSSWALK_SELECT_MISSING,SOURCE_SCOPE_EXECUTE_MISSING/,
  );
});

test("worker principal attestation rejects application role reuse", async () => {
  await assert.rejects(
    () => assertGovernmentInboxWorkerPrincipal(
      principalPool({ ...leastPrivilegePrincipal, role_name: "web" }),
      "postgres://web:secret@db.example/rupaykg",
    ),
    /APPLICATION_ROLE_REUSE/,
  );
});

test("worker principal attestation fails closed on missing role catalog row", async () => {
  const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
  await assert.rejects(
    () => assertGovernmentInboxWorkerPrincipal(pool),
    /GOVERNMENT_INBOX_WORKER_PRINCIPAL_NOT_FOUND/,
  );
});

test("worker principal attestation rejects malformed application database identity", async () => {
  await assert.rejects(
    () => assertGovernmentInboxWorkerPrincipal(principalPool(leastPrivilegePrincipal), "not-a-url"),
    /GOVERNMENT_INBOX_APPLICATION_PRINCIPAL_INVALID/,
  );
});


test("combined worker readiness runs schema attestation before principal attestation", async () => {
  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      if (/from pg_roles r where r\.rolname=current_user/.test(sql)) {
        calls.push("principal");
        return { rows: [leastPrivilegePrincipal], rowCount: 1 };
      }
      calls.push("schema");
      return { rows: [readySchema], rowCount: 1 };
    },
  } as unknown as Pool;
  await assert.doesNotReject(() => assertGovernmentInboxWorkerReady(
    pool,
    "postgres://web:secret@db.example/rupaykg",
  ));
  assert.deepEqual(calls, ["schema", "principal"]);
});

test("combined worker readiness stops before principal query when schema is incomplete", async () => {
  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      if (/from pg_roles r where r\.rolname=current_user/.test(sql)) {
        calls.push("principal");
        return { rows: [leastPrivilegePrincipal], rowCount: 1 };
      }
      calls.push("schema");
      return { rows: [{ ...readySchema, inbox_table: null }], rowCount: 1 };
    },
  } as unknown as Pool;
  await assert.rejects(() => assertGovernmentInboxWorkerReady(pool), /GOVERNMENT_INBOX_SCHEMA_NOT_READY/);
  assert.deepEqual(calls, ["schema"]);
});


test("worker principal attestation rejects table-wide inbox UPDATE even when column grants exist", async () => {
  await assert.rejects(
    () => assertGovernmentInboxWorkerPrincipal(
      principalPool({ ...leastPrivilegePrincipal, inbox_table_update: true }),
    ),
    /INBOX_TABLE_LEVEL_UPDATE_TOO_BROAD/,
  );
});


test("worker principal attestation rejects inbox INSERT and DELETE privileges", async () => {
  for (const unsafe of [
    { ...leastPrivilegePrincipal, inbox_insert: true },
    { ...leastPrivilegePrincipal, inbox_delete: true },
  ]) {
    await assert.rejects(
      () => assertGovernmentInboxWorkerPrincipal(principalPool(unsafe)),
      /INBOX_(INSERT_NOT_ALLOWED|DELETE_NOT_ALLOWED)/,
    );
  }
});
