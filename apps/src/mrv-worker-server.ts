import { randomUUID } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import { runMrvSubmissionWorkerOnce } from "./mrv-submission-worker.js";

const expectedRole = "rupaykg_mrv_worker_runtime";
const requiredTables = [
  "organizations", "identities", "organization_memberships", "roles", "activities",
  "evidence", "verifications", "geography", "mrv_submission_jobs",
  "mrv_submission_job_events", "mrv_provenance_events",
];

async function main(): Promise<void> {
  if (process.env.RUPAYKG_MRV_WORKER_ENABLED !== "true") throw new Error("MRV_WORKER_DISABLED");
  const connectionString = process.env.MRV_WORKER_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("MRV_WORKER_DATABASE_URL_REQUIRED");

  const config: PoolConfig = { connectionString, max: 2, application_name: "rupaykg-mrv-worker" };
  if (process.env.DATABASE_SSL === "require") config.ssl = { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT };
  else if (process.env.DATABASE_SSL !== "false") config.ssl = { rejectUnauthorized: false };
  const pool = new Pool(config);
  const workerId = process.env.MRV_WORKER_ID?.trim() || `mrv-worker-${randomUUID()}`;
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);

  try {
    const identity = await pool.query<{
      current_user: string; rolcanlogin: boolean; rolinherit: boolean; rolsuper: boolean;
      rolbypassrls: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolreplication: boolean;
      owner_membership: boolean; geography_scope_execute: boolean;
    }>(
      `select current_user,
              r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,
              pg_has_role(current_user,'rupaykg_app_owner','MEMBER')
                or pg_has_role(current_user,'rupaykg_auth_owner','MEMBER') as owner_membership,
              has_function_privilege(current_user,'public.organization_has_geography_scope(uuid,uuid)','EXECUTE') as geography_scope_execute
         from pg_roles r where r.rolname=current_user`,
    );
    const role = identity.rows[0];
    if (!role || role.current_user !== expectedRole || !role.rolcanlogin || role.rolinherit
        || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole
        || role.rolreplication || role.owner_membership || !role.geography_scope_execute) {
      throw new Error("MRV_WORKER_DATABASE_ROLE_CONTRACT_FAILED");
    }

    const rls = await pool.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select c.relname,c.relrowsecurity,c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname=any($1::text[])`,
      [requiredTables],
    );
    const byName = new Map(rls.rows.map(row => [row.relname, row]));
    const unsafe = requiredTables.filter(name => !byName.get(name)?.relrowsecurity || !byName.get(name)?.relforcerowsecurity);
    if (unsafe.length) throw new Error(`MRV_WORKER_RLS_FORCE_REQUIRED:${unsafe.join(",")}`);
    console.info(JSON.stringify({ event: "MRV_WORKER_READY", workerId, databaseRole: role.current_user, rlsForcedTables: requiredTables.length }));

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
