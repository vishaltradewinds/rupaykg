import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
      create function reject_async_mirror_event_mutation() returns trigger language plpgsql as $$
      begin
        raise exception 'async_mirror_inbox_events is append-only';
      end $$;
      create trigger async_mirror_inbox_events_immutable
        before update or delete on async_mirror_inbox_events
        for each row execute function reject_async_mirror_event_mutation();

      create table official_acceptance_records (id uuid primary key);
      create table authoritative_mrv_records (id uuid primary key);
      create table guardian_hcs_submissions (id uuid primary key);
      insert into official_acceptance_records values ('10000000-0000-4000-8000-000000000001');
      insert into authoritative_mrv_records values ('10000000-0000-4000-8000-000000000002');
      insert into guardian_hcs_submissions values ('10000000-0000-4000-8000-000000000003');

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
    // Keep the historical-schema retry out of the immediately following run so
    // the second assertion deterministically exercises the corrected-schema row.
    await pool.query("update async_mirror_inbox set next_attempt_at=now() + interval '1 hour' where id=$1", [oldSchemaId]);

    // Apply the exact proposed forward-migration source to this disposable schema.
    // This validates the migration's SQL and the real worker together; it does
    // not apply the migration to production/staging or authorize release.
    const migrationCandidates = [
      resolve(process.cwd(), "migrations/20261101_async_mirror_unresolved_crosswalk.sql"),
      resolve(process.cwd(), "../migrations/20261101_async_mirror_unresolved_crosswalk.sql"),
    ];
    const migrationPath = migrationCandidates.find((candidate) => existsSync(candidate));
    assert.ok(migrationPath, "corrective migration source must exist in the test checkout");
    await pool.query(readFileSync(migrationPath, "utf8"));
    const authoritativeBefore = await pool.query(`
      select
        (select count(*)::int from official_acceptance_records) as official_acceptance,
        (select count(*)::int from authoritative_mrv_records) as authoritative_mrv,
        (select count(*)::int from guardian_hcs_submissions) as guardian_hcs
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
    const authoritativeAfter = await pool.query(`
      select
        (select count(*)::int from official_acceptance_records) as official_acceptance,
        (select count(*)::int from authoritative_mrv_records) as authoritative_mrv,
        (select count(*)::int from guardian_hcs_submissions) as guardian_hcs
    `);
    assert.deepEqual(
      authoritativeAfter.rows[0],
      authoritativeBefore.rows[0],
      "UNRESOLVED must not mutate official acceptance, authoritative MRV, or Guardian/HCS submission tables",
    );

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
    const eventId = (await pool.query(
      "select id from async_mirror_inbox_events where inbox_id=$1 order by id limit 1",
      [correctedSchemaId],
    )).rows[0]?.id;
    assert.ok(eventId, "status transition must have an event row");
    await assert.rejects(
      pool.query("update async_mirror_inbox_events set error_code='tampered' where id=$1", [eventId]),
      /append-only/,
      "event UPDATE must be rejected",
    );
    await assert.rejects(
      pool.query("delete from async_mirror_inbox_events where id=$1", [eventId]),
      /append-only/,
      "event DELETE must be rejected",
    );

    // Retry exhaustion must quarantine the row rather than process it again.
    const exhaustedId = randomUUID();
    const exhaustedBatchId = randomUUID();
    const exhaustedPayload = makePayload(exhaustedBatchId);
    await pool.query(
      `insert into async_mirror_inbox
        (id,authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,attempts,status,next_attempt_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,5,'RETRY',now())`,
      [exhaustedId,"TEST-AUTHORITY","TEST-MUNICIPALITY",exhaustedBatchId,"2026-10-19T02:30:00Z",JSON.stringify(exhaustedPayload),canonicalGovBridgeHash(exhaustedPayload)],
    );
    await runGovernmentInboxWorker(pool, undefined, { batchSize: 1, maxAttempts: 5 });
    const exhaustedState = (await pool.query(
      "select status,last_error_code,lease_token,lease_until,quarantined_at from async_mirror_inbox where id=$1",
      [exhaustedId],
    )).rows[0];
    assert.equal(exhaustedState.status, "QUARANTINED");
    assert.equal(exhaustedState.last_error_code, "WORKER_ATTEMPTS_EXHAUSTED");
    assert.equal(exhaustedState.lease_token, null);
    assert.equal(exhaustedState.lease_until, null);
    assert.ok(exhaustedState.quarantined_at);

    // Expired leases are recoverable, but the row must still end unresolved
    // when no verified current jurisdiction crosswalk exists.
    const expiredId = randomUUID();
    const expiredBatchId = randomUUID();
    const expiredPayload = makePayload(expiredBatchId);
    await pool.query(
      `insert into async_mirror_inbox
        (id,authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,attempts,status,lease_token,lease_until)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,1,'PROCESSING',$8,now()-interval '1 minute')`,
      [expiredId,"TEST-AUTHORITY","TEST-MUNICIPALITY",expiredBatchId,"2026-10-19T02:30:00Z",JSON.stringify(expiredPayload),canonicalGovBridgeHash(expiredPayload),randomUUID()],
    );
    const expiredResult = await runGovernmentInboxWorker(pool, undefined, { batchSize: 1, maxAttempts: 5 });
    assert.equal(expiredResult.claimed, 1, "expired lease must be reclaimed");
    const expiredState = (await pool.query(
      "select status,lease_token,lease_until,validation_summary from async_mirror_inbox where id=$1",
      [expiredId],
    )).rows[0];
    assert.equal(expiredState.status, "UNRESOLVED");
    assert.equal(expiredState.lease_token, null);
    assert.equal(expiredState.lease_until, null);
    assert.equal(expiredState.validation_summary?.officialAcceptance, false);
    assert.equal(expiredState.validation_summary?.authoritativeMrvMutation, false);
    assert.equal(expiredState.validation_summary?.guardianSubmission, false);

    // A PROCESSING row with a NULL lease is recoverable too. The quarantine
    // predicate already treats this as expired; claim must use the same rule.
    const nullLeaseId = randomUUID();
    const nullLeaseBatchId = randomUUID();
    const nullLeasePayload = makePayload(nullLeaseBatchId);
    await pool.query(
      `insert into async_mirror_inbox
        (id,authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,attempts,status,lease_token,lease_until)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,1,'PROCESSING',$8,null)`,
      [nullLeaseId,"TEST-AUTHORITY","TEST-MUNICIPALITY",nullLeaseBatchId,"2026-10-19T02:30:00Z",JSON.stringify(nullLeasePayload),canonicalGovBridgeHash(nullLeasePayload),randomUUID()],
    );
    const nullLeaseResult = await runGovernmentInboxWorker(pool, undefined, { batchSize: 1, maxAttempts: 5 });
    assert.equal(nullLeaseResult.claimed, 1, "PROCESSING row with NULL lease must be reclaimed");
    assert.equal(nullLeaseResult.unresolved, 1, "reclaimed row without a verified crosswalk must remain unresolved");
    const nullLeaseState = (await pool.query(
      "select status,lease_token,lease_until,validation_summary from async_mirror_inbox where id=$1",
      [nullLeaseId],
    )).rows[0];
    assert.equal(nullLeaseState.status, "UNRESOLVED");
    assert.equal(nullLeaseState.lease_token, null);
    assert.equal(nullLeaseState.lease_until, null);
    assert.equal(nullLeaseState.validation_summary?.officialAcceptance, false);
    assert.equal(nullLeaseState.validation_summary?.authoritativeMrvMutation, false);
    assert.equal(nullLeaseState.validation_summary?.guardianSubmission, false);

    // A stale worker must not finalize a row after another claimant rotates
    // the fencing token. The callback simulates that intervening claimant.
    const staleId = randomUUID();
    const staleBatchId = randomUUID();
    const stalePayload = makePayload(staleBatchId);
    await pool.query(
      `insert into async_mirror_inbox
        (id,authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [staleId,"TEST-AUTHORITY","TEST-MUNICIPALITY",staleBatchId,"2026-10-19T02:30:00Z",JSON.stringify(stalePayload),canonicalGovBridgeHash(stalePayload)],
    );
    const staleResult = await runGovernmentInboxWorker(pool, async (input) => {
      await pool!.query("update async_mirror_inbox set lease_token=$2 where id=$1", [input.id, randomUUID()]);
      return { valid: false, errorCode: "STALE_WORKER_SIMULATION" };
    }, { batchSize: 1, maxAttempts: 5 });
    assert.equal(staleResult.claimed, 1);
    assert.equal(staleResult.rejected, 0, "stale worker must not count a transition it did not own");
    const staleState = (await pool.query(
      "select status,lease_token,last_error_code from async_mirror_inbox where id=$1",
      [staleId],
    )).rows[0];
    assert.equal(staleState.status, "PROCESSING", "stale worker must not finalize another claimant's row");
    assert.ok(staleState.lease_token);
    assert.notEqual(staleState.last_error_code, "STALE_WORKER_SIMULATION");
  } finally {
    await pool?.end();
    await admin.query(`drop schema if exists "${schema}" cascade`).catch(() => undefined);
    await admin.end();
  }
});
