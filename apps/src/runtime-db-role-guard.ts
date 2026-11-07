import { Pool } from "pg";

export type RuntimeDbRoleEvidence = {
  roleName: string;
  superuser: boolean;
  createRole: boolean;
  createDb: boolean;
  replication: boolean;
  bypassRls: boolean;
};

export async function assertProductionRuntimeDbRole(): Promise<RuntimeDbRoleEvidence> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("RUNTIME_DB_ROLE_GUARD_BLOCKED: DATABASE_URL is not configured.");

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    ssl:
      process.env.DATABASE_SSL === "require"
        ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT || undefined }
        : process.env.DATABASE_SSL === "false"
          ? undefined
          : { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query<{
      role_name: string;
      superuser: boolean;
      create_role: boolean;
      create_db: boolean;
      replication: boolean;
      bypass_rls: boolean;
    }>(`
      select current_user as role_name, r.rolsuper as superuser,
             r.rolcreaterole as create_role, r.rolcreatedb as create_db,
             r.rolreplication as replication, r.rolbypassrls as bypass_rls
      from pg_roles r where r.rolname = current_user
    `);

    const evidence = result.rows[0];
    if (!evidence) throw new Error("RUNTIME_DB_ROLE_GUARD_BLOCKED: current PostgreSQL role could not be resolved.");

    if (evidence.superuser || evidence.create_role || evidence.create_db || evidence.replication || evidence.bypass_rls) {
      throw new Error(`RUNTIME_DB_ROLE_GUARD_BLOCKED: runtime identity ${evidence.role_name} has administrative or RLS-bypass capability.`);
    }

    const expectedRole = process.env.RUPAYKG_EXPECTED_RUNTIME_DB_ROLE?.trim();
    if (expectedRole && evidence.role_name !== expectedRole) {
      throw new Error(`RUNTIME_DB_ROLE_GUARD_BLOCKED: expected runtime role '${expectedRole}', actual role is '${evidence.role_name}'.`);
    }

    console.log(`RUNTIME_DB_ROLE_GUARD: PASS (${evidence.role_name}; NOBYPASSRLS/non-admin)`);
    return {\n      roleName: evidence.role_name,\n      superuser: evidence.superuser,\n      createRole: evidence.create_role,\n      createDb: evidence.create_db,\n      replication: evidence.replication,\n      bypassRls: evidence.bypass_rls,\n    };
  } finally {
    await pool.end();
  }
}
