import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.CI === "true"
  && process.env.NODE_ENV !== "production"
  && process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1"
  && Boolean(process.env.DATABASE_URL);

test("inbox event trigger appends through a restricted NOLOGIN definer without event-table INSERT for worker", {
  skip: !enabled ? "requires disposable CI PostgreSQL and applied migrations" : false,
}, async () => {
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true },
    max: 2,
  });
  const roleName = "rk_worker_test_" + randomUUID().replace(/-/g, "").slice(0, 16);
  const password = randomBytes(24).toString("base64url");
  const inboxId = randomUUID();
  const batchId = randomUUID();
  let worker: Pool | undefined;

  try {
    const owner = await admin.query<{
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
    }>(
      `select r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb
         from pg_roles r where r.rolname='rupaykg_inbox_event_writer'`,
    );
    assert.equal(owner.rows.length, 1, "dedicated event-writer role must exist");
    assert.equal(owner.rows[0]!.rolcanlogin, false);
    assert.equal(owner.rows[0]!.rolsuper, false);
    assert.equal(owner.rows[0]!.rolbypassrls, false);
    assert.equal(owner.rows[0]!.rolcreaterole, false);
    assert.equal(owner.rows[0]!.rolcreatedb, false);

    const functionOwner = await admin.query<{ owner: string; security_definer: boolean; config: string[] | null }>(
      `select r.rolname as owner,p.prosecdef as security_definer,p.proconfig as config
         from pg_proc p join pg_roles r on r.oid=p.proowner
        where p.oid='public.record_async_mirror_inbox_event()'::regprocedure`,
    );
    assert.equal(functionOwner.rows[0]?.owner, "rupaykg_inbox_event_writer");
    assert.equal(functionOwner.rows[0]?.security_definer, true);
    assert.ok(functionOwner.rows[0]?.config?.some((v) => v.replace(/\\s/g, "") === "search_path=pg_catalog,public"));

    const ownerPrivileges = await admin.query<{ insert_allowed: boolean; usage_allowed: boolean; select_allowed: boolean; delete_allowed: boolean }>(
      `select has_table_privilege('rupaykg_inbox_event_writer','public.async_mirror_inbox_events','INSERT') as insert_allowed,
              has_sequence_privilege('rupaykg_inbox_event_writer','public.async_mirror_inbox_events_id_seq','USAGE') as usage_allowed,
              has_table_privilege('rupaykg_inbox_event_writer','public.async_mirror_inbox_events','SELECT') as select_allowed,
              has_table_privilege('rupaykg_inbox_event_writer','public.async_mirror_inbox_events','DELETE') as delete_allowed`,
    );
    assert.equal(ownerPrivileges.rows[0]?.insert_allowed, true);
    assert.equal(ownerPrivileges.rows[0]?.usage_allowed, true);
    assert.equal(ownerPrivileges.rows[0]?.select_allowed, false);
    assert.equal(ownerPrivileges.rows[0]?.delete_allowed, false);

    await admin.query(`create role "${roleName}" login password '${password}' nosuperuser nocreatedb nocreaterole noinherit nobypassrls`);
    await admin.query(`grant usage on schema public to "${roleName}"`);
    await admin.query(`grant select on public.async_mirror_inbox to "${roleName}"`);
    await admin.query(`grant update (attempts,status,lease_token,lease_until,next_attempt_at,processed_at,quarantined_at,last_error_code,validation_summary) on public.async_mirror_inbox to "${roleName}"`);

    const connection = new URL(process.env.DATABASE_URL!);
    connection.username = roleName;
    connection.password = password;
    worker = new Pool({
      connectionString: connection.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true },
      max: 1,
    });

    const workerIdentity = await worker.query<{ session_user: string; current_user: string; rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; rolcreatedb: boolean }>(
      `select session_user,current_user,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb
         from pg_roles r where r.rolname=current_user`,
    );
    assert.equal(workerIdentity.rows[0]?.session_user, roleName);
    assert.equal(workerIdentity.rows[0]?.current_user, roleName);
    assert.equal(workerIdentity.rows[0]?.rolsuper, false);
    assert.equal(workerIdentity.rows[0]?.rolbypassrls, false);
    assert.equal(workerIdentity.rows[0]?.rolcreaterole, false);
    assert.equal(workerIdentity.rows[0]?.rolcreatedb, false);

    const before = await admin.query<{ count: string }>(
      "select count(*)::text as count from public.async_mirror_inbox_events where inbox_id=$1",
      [inboxId],
    );
    await admin.query(
      `insert into public.async_mirror_inbox
        (id,authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status,attempts)
       values($1,'TST-WORKER','TST-MUNI',$2,now(),'{}'::jsonb,$3,'RECEIVED',0)`,
      [inboxId, batchId, "a".repeat(64)],
    );

    const afterInsert = await admin.query<{ count: string }>(
      "select count(*)::text as count from public.async_mirror_inbox_events where inbox_id=$1",
      [inboxId],
    );
    assert.equal(Number(afterInsert.rows[0]?.count), Number(before.rows[0]?.count ?? 0) + 1);

    await worker.query(
      `update public.async_mirror_inbox
          set status='PROCESSING',attempts=1,lease_token=$2,lease_until=now()+interval '2 minutes'
        where id=$1`,
      [inboxId, randomUUID()],
    );
    const afterWorkerUpdate = await admin.query<{ count: string }>(
      "select count(*)::text as count from public.async_mirror_inbox_events where inbox_id=$1",
      [inboxId],
    );
    assert.equal(Number(afterWorkerUpdate.rows[0]?.count), Number(afterInsert.rows[0]?.count) + 1,
      "invoker with no event-table INSERT must still cause the trigger to append one event");

    await assert.rejects(
      worker.query(
        `insert into public.async_mirror_inbox_events
          (inbox_id,authority_code,municipal_code,batch_id,to_status,attempt,payload_sha256)
         values($1,'TST-WORKER','TST-MUNI',$2,'FORGED',1,$3)`,
        [inboxId, batchId, "a".repeat(64)],
      ),
      /permission denied|not owner/i,
      "worker must not be able to forge event rows directly",
    );
    await assert.rejects(
      worker.query("delete from public.async_mirror_inbox where id=$1", [inboxId]),
      /permission denied/i,
      "worker must not delete inbox rows",
    );
    await assert.rejects(
      worker.query("update public.async_mirror_inbox set payload_sha256=$2 where id=$1", [inboxId, "b".repeat(64)]),
      /permission denied/i,
      "worker must not rewrite the immutable payload hash",
    );
    await assert.rejects(
      worker.query("select * from public.evidence limit 1"),
      /permission denied/i,
      "worker must not read unrelated evidence data",
    );
    await assert.rejects(
      worker.query("create table public.worker_forbidden_ddl(id integer)"),
      /permission denied/i,
      "worker must not create schema objects",
    );
  } finally {
    if (worker) await worker.end();
    await admin.query(`drop role if exists "${roleName}"`);
    await admin.end();
  }
});
