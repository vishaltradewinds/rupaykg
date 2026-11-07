import { Pool } from "pg";

export async function assertProductionRuntimeDbRole(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("RUNTIME_DB_ROLE_GUARD: DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: url, max: 1, ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT || undefined } : undefined });
  try {
    const { rows } = await pool.query<{ role_name:string; rolsuper:boolean; rolcreaterole:boolean; rolcreatedb:boolean; rolreplication:boolean; rolbypassrls:boolean }>(`
      select current_user as role_name, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
      from pg_roles where rolname = current_user
    `);
    const r=rows[0];
    if(!r) throw new Error("RUNTIME_DB_ROLE_GUARD: current PostgreSQL role could not be resolved.");
    const privileged=Boolean(r.rolsuper||r.rolcreaterole||r.rolcreatedb||r.rolreplication||r.rolbypassrls);
    if(privileged) throw new Error(`RUNTIME_DB_ROLE_GUARD_BLOCKED: runtime identity ${r.role_name} has administrative or RLS-bypass capability.`);
    console.log(`RUNTIME_DB_ROLE_GUARD: PASS (${r.role_name}; NOBYPASSRLS/non-admin)`);
  } finally { await pool.end(); }
}
