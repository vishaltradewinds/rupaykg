import { randomUUID } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import { runMrvSubmissionWorkerOnce } from "./mrv-submission-worker.js";
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
      `select current_user, session_user,
              r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,
              pg_has_role(current_user,'rupaykg_app_owner','MEMBER')
                or pg_has_role(current_user,'rupaykg_auth_owner','MEMBER') as owner_membership,
              pg_has_role(current_user,'pg_read_all_data','MEMBER')
                or pg_has_role(current_user,'pg_write_all_data','MEMBER') as elevated_membership,
              exists(select 1 from pg_auth_members m where m.member=r.oid) as any_role_membership,
              has_schema_privilege(current_user,'public','CREATE') as public_create,
              exists(
                select 1 from information_schema.role_table_grants g
                 where g.grantee=current_user and g.table_schema='public'
                   and g.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
              ) as direct_table_privileges,
              has_function_privilege(current_user,'mrv_worker_api.claim_next_job(text,integer)','EXECUTE')
                as worker_api_execute,
              exists(
                select 1
                  from pg_proc api
                  cross join lateral aclexplode(coalesce(api.proacl, acldefault('f', api.proowner))) acl
                 where api.oid=to_regprocedure('mrv_worker_api.claim_next_job(text,integer)')
                   and acl.grantee=0
                   and acl.privilege_type='EXECUTE'
              ) as public_worker_api_execute
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
    console.info(JSON.stringify({ event: "MRV_WORKER_READY", workerId, databaseRole: identity.rows[0].current_user, rlsForcedTables: requiredTables.length }));

    while (!stopping) {
      try {
        const result = await runMrvSubmissionWorkerOnce(pool, workerId);
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
