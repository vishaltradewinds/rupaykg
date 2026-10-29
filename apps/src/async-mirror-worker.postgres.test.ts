import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { canonicalGovBridgeHash } from "./government-inbox-hash.js";
import { runGovernmentInboxWorker } from "./async-mirror-worker.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

test("real government inbox worker obeys PostgreSQL status constraints and preserves audit events", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL and RUPAYKG_RUN_DB_INTEGRATION_TESTS=1" : false,
}, async () => {
  const admin = new Pool({ connectionString: databaseUrl, max: 1 });
  const schema = `worker_it_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool | undefined;
  try {
    await admin.query(`create schema "${schema}"`);
    pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
      options: `-c search_path=${schema},public`,
    });

    await pool.query(`
      create table async_mirror_inbox (
        id uuid primary key,
        authority_code text not null,
        municipal_code text not null,
        batch_id uuid not null,
        sync_window_timestamp timestamptz not null,
        payload jsonb not null,
        payload_sha256 char(64) not null,
        attempts integer not null default 0,
        status text not null default 'RECEIVED'
          check (status in ('RECEIVED','PROCESSING','PROCESSED','VALIDATED','REJECTED','RETRY','QUARANTINED')),
        received_at timestamptz not null default now(),
        lease_token uuid,
        lease_until timestamptz,
        next_attempt_at timestamptz,
        quarantined_at timestamptz,
        processed_at timestamptz,
        last_error_code text,
        validation_summary jsonb
      );
      create table async_mirror_inbox_events (
        id bigserial primary key,
        inbox_id uuid not null references async_mirror_inbox(id),
        authority_code text not null,
        municipal_code text not null,
        batch_id uuid not null,
        from_status text,
        to_status text not null,
        attempt integer not null check (attempt >= 0),
        payload_sha256 char(64) not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
        error_code text,
        occurred_at timestamptz not null default now()
      );
      create function record_async_mirror_inbox_event() returns trigger language plpgsql as $$
      begin
        if TG_OP = 'INSERT' or old.status is distinct from new.status or old.attempts is distinct from new.attempts then
          insert into async_mirror_inbox_events
            (inbox_id, authority_code, municipal_code, batch_id, from_status, to_status, attempt, payload_sha256, error_code)
          values
            (new.id, new.authority_code, new.municipal_code, new.batch_id,
             case when TG_OP = 'INSERT' then null else old.status end,
             new.status, new.attempts, new.payload_sha256, new.last_error_code);
        end if;
        return new;
      end $$;
      create trigger async_mirror_inbox_event_after_change
        after insert or update on async_mirror_inbox
        for each row execute function record_async_mirror_inbox_event();

      create table authoritative_source_snapshots (
        id uuid primary key,
        validation_status text not null,
        authority_code text not null,
        source_version text not null,
        effective_from date,
        effective_to date
      );
      create table government_jurisdiction_crosswalks (
        id uuid primary key,
        source_snapshot_id uuid not null,
        authority_code text not null,
        municipal_code text not null,
        organization_id uuid not null,
        geography_id uuid not null,
        activity_id uuid,
        source_version text not null,
        status text not null,
        effective_from timestamptz not null,
        effective_to timestamptz
      );
      create table activities (
        id uuid primary key,
        organization_id uuid not null,
        geography_id uuid not null
      );
      create function organization_has_explicit_geography_scope(uuid, uuid) returns boolean
        language sql immutable as $$ select true $$;
    `);

    const makePayload = (batchId: string) => ({
      batchMetadata: {
        authorityCode: "TEST-AUTHORITY",
        municipalCode: "TEST-MUNICIPALITY",
        batchId,
        syncWindowTimestamp: "2026-10-19T02:30:00Z",
        sourceVersion: "integration-test-v1",
      },
      rawDataLogs: ["Synthetic authorized-source waste collection record"],
    });

    const insertInbox = async () => {
      const id = randomUUID();
      const batchId = randomUUID();
      const payload = makePayload(batchId);
      await pool!.query(
        `insert into async_mirror_inbox
          (id, authority_code, municipal_code, batch_id, sync_window_timestamp, payload, payload_sha256)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [id, "TEST-AUTHORITY", "TEST-MUNICIPALITY", batchId, "2026-10-19T02:30:00Z", JSON.stringify(payload), canonicalGovBridgeHash(payload)],
      );
      return id;
    };

    // The historical lease schema omits UNRESOLVED. The real worker must not
    // falsely validate the batch; the failed transition should fall back to RETRY.
    const oldSchemaId = await insertInbox();
    const oldSchemaResult = await runGovernmentInboxWorker(pool, undefined, { batchSize: 1, maxAttempts: 5 });
    assert.equal(oldSchemaResult.claimed, 1);
    assert.equal(oldSchemaResult.validated, 0);
    assert.equal(oldSchemaResult.unresolved, 0);
    assert.equal(oldSchemaResult.retried, 1);
    const oldState = await pool.query("select status from async_mirror_inbox where id=$1", [oldSchemaId]);
    assert.equal(oldState.rows[0]?.status, "RETRY");

    // Corrective constraint is a test-only disposable schema change, not a live migration.
    await pool.query(`
      alter table async_mirror_inbox drop constraint async_mirror_inbox_status_check;
      alter table async_mirror_inbox add constraint async_mirror_inbox_status_check
        check (status in ('RECEIVED','PROCESSING','PROCESSED','VALIDATED','REJECTED','RETRY','QUARANTINED','UNRESOLVED'));
    `);
    const correctedSchemaId = await insertInbox();
    const correctedResult = await runGovernmentInboxWorker(pool, undefined, { batchSize: 1, maxAttempts: 5 });
    assert.equal(correctedResult.claimed, 1);
    assert.equal(correctedResult.validated, 0);
    assert.equal(correctedResult.unresolved, 1);
    const correctedState = await pool.query(
      "select status,last_error_code,validation_summary from async_mirror_inbox where id=$1",
      [correctedSchemaId],
    );
    assert.equal(correctedState.rows[0]?.status, "UNRESOLVED");
    assert.equal(correctedState.rows[0]?.last_error_code, "GOVERNMENT_CROSSWALK_NOT_FOUND");
    assert.equal(correctedState.rows[0]?.validation_summary?.officialAcceptance, false);
    assert.equal(correctedState.rows[0]?.validation_summary?.authoritativeMrvMutation, false);
    assert.equal(correctedState.rows[0]?.validation_summary?.guardianSubmission, false);

    await assert.rejects(
      pool.query("update async_mirror_inbox set status='MADE_UP_STATUS' where id=$1", [correctedSchemaId]),
      /check constraint/i,
    );
    const records = await pool.query(
      "select count(*)::int as inbox_count from async_mirror_inbox where id in ($1,$2)",
      [oldSchemaId, correctedSchemaId],
    );
    const events = await pool.query(
      "select count(*)::int as event_count from async_mirror_inbox_events where inbox_id in ($1,$2)",
      [oldSchemaId, correctedSchemaId],
    );
    assert.equal(records.rows[0]?.inbox_count, 2, "inbox records must remain preserved");
    assert.ok(events.rows[0]?.event_count >= 5, "append-only status/attempt event history must be preserved");
  } finally {
    await pool?.end();
    await admin.query(`drop schema if exists "${schema}" cascade`).catch(() => undefined);
    await admin.end();
  }
});
