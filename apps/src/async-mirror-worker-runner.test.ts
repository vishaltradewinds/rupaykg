import test from "node:test";
import assert from "node:assert/strict";
import type { Pool, PoolConfig } from "pg";
import {
  assertGovernmentInboxWorkerSchema,
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
