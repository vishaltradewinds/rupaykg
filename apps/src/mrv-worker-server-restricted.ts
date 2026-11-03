import { randomUUID } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import { runMrvSubmissionWorkerOnce } from "./mrv-submission-worker-restricted.js";
import { MrvWorkerDatabaseApi } from "./mrv-worker-database-api.js";
import { assertMrvWorkerRoleContract, type MrvWorkerRoleContract } from "./mrv-worker-role-contract.js";

const requiredTables = [
  "organizations", "identities", "organization_memberships", "roles", "activities",
  "evidence", "verifications", "geography", "mrv_observations", "measurements", "mrv_submission_jobs",
  "mrv_submission_job_events", "mrv_provenance_events",
];

async function main(): Promise<void> {
  if (process.env.RUPAYKG_MRV_WORKER_ENABLED !== "true") throw new Error("MRV_WORKER_DISABLED");
  const connectionString = process.env.MRV_WORKER_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("MRV_WORKER_DATABASE_URL_REQUIRED");

  const config: PoolConfig = { connectionString, max: 2, application_name: "rupaykg-mrv-worker" };
  if (process.env.DATABASE_SSL === "false") {
    if (process.env.NODE_ENV === "production") throw new Error("MRV_WORKER_TLS_REQUIRED_IN_PRODUCTION");
  } else {
    config.ssl = { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT } : {}) };
  }
  const pool = new Pool(config);
  const workerId = process.env.MRV_WORKER_ID?.trim() || `mrv-worker-${randomUUID()}`;
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);

  try {
    const identity = await pool.query<MrvWorkerRoleContract>(
      `with required(signature) as (values
        ('mrv_worker_api.claim_next_job(text,integer)'),
        ('mrv_worker_api.authorize_job(uuid)'),
        ('mrv_worker_api.persist_guardian_binding(uuid,uuid,text)'),
        ('mrv_worker_api.persist_hedera_binding(uuid,uuid,text,text,text)'),
        ('mrv_worker_api.renew_lease(uuid,uuid,integer)'),
        ('mrv_worker_api.advance_job(uuid,uuid,text,jsonb)'),
        ('mrv_worker_api.release_job(uuid,uuid,timestamptz,text,text)'),
        ('mrv_worker_api.finalize_provenance(uuid,uuid,text)')
      ), api as (
        select r.signature, p.oid, p.proowner, p.proconfig, p.prosecdef, p.proacl
          from required r left join pg_proc p on p.oid=to_regprocedure(r.signature)
      )
      select current_user, session_user,
             r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,
             pg_has_role(current_user,'rupaykg_app_owner','MEMBER')
               or pg_has_role(current_user,'rupaykg_auth_owner','MEMBER') as owner_membership,
             pg_has_role(current_user,'pg_read_all_data','MEMBER')
               or pg_has_role(current_user,'pg_write_all_data','MEMBER') as elevated_membership,
             exists(select 1 from pg_auth_members m where m.member=r.oid) as any_role_membership,
             has_schema_privilege(current_user,'public','CREATE') as public_create,
             exists(select 1 from information_schema.role_table_grants g
                     where g.grantee=current_user and g.table_schema='public'
                       and g.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
             ) as direct_table_privileges,
             has_function_privilege(current_user,'mrv_worker_api.claim_next_job(text,integer)','EXECUTE')
               as worker_api_execute,
             exists(select 1 from api a cross join lateral aclexplode(coalesce(a.proacl,acldefault('f',a.proowner))) acl
                     where a.signature='mrv_worker_api.claim_next_job(text,integer)'
                       and acl.grantee=0 and acl.privilege_type='EXECUTE') as public_worker_api_execute,
             (select count(*)=8 and bool_and(oid is not null) from api) as worker_api_complete,
             (select count(*)=8 and bool_and(
                prosecdef and proowner=(select oid from pg_roles where rolname='rupaykg_mrv_worker_api_owner')
                and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog']
                and has_function_privilege(current_user,oid,'EXECUTE')
                and not exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) x
                                where x.grantee=0 and x.privilege_type='EXECUTE')
              ) from api) as worker_api_secure
        from pg_roles r where r.rolname=current_user`,
    );
    assertMrvWorkerRoleContract(identity.rows[0]);
    const rls = await pool.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select c.relname,c.relrowsecurity,c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname=any($1::text[])`,
      [requiredTables],
    );
    const byName = new Map(rls.rows.map(row => [row.relname, row]));
    const unsafe = requiredTables.filter(name => !byName.get(name)?.relrowsecurity || !byName.get(name)?.relforcerowsecurity);
    if (unsafe.length) throw new Error(`MRV_WORKER_RLS_FORCE_REQUIRED:${unsafe.join(",")}`);
    const database = new MrvWorkerDatabaseApi(pool);
    console.info(JSON.stringify({ event: "MRV_WORKER_READY", workerId, databaseRole: identity.rows[0].current_user, rlsForcedTables: requiredTables.length, databaseApi: "function-only" }));

    while (!stopping) {
      try {
        const result = await runMrvSubmissionWorkerOnce(database, workerId);
        if (result.outcome !== "IDLE") console.info(JSON.stringify({ event: "MRV_WORKER_STAGE", ...result }));
        await new Promise(resolve => setTimeout(resolve, result.outcome === "IDLE" ? 5000 : 500));
      } catch (error) {
        console.error(JSON.stringify({ event: "MRV_WORKER_ERROR", message: error instanceof Error ? error.message : String(error) }));
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  } finally {
    await pool.end();
  }
}

await main();
