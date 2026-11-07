import process from "node:process";

async function main() {
  const { Pool } = await import("pg");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("RUNTIME ROLE GUARD BLOCKED: DATABASE_URL is not configured.");

  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(`
      SELECT current_user AS role_name,
             rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const r = rows[0];
    if (!r) throw new Error("RUNTIME ROLE GUARD BLOCKED: current PostgreSQL role could not be resolved.");

    console.log("=== RUPAYKG G-002 RUNTIME DB ROLE GUARD ===");
    console.log(`role: ${r.role_name}`);
    console.log(`superuser: ${r.rolsuper}`);
    console.log(`create role: ${r.rolcreaterole}`);
    console.log(`create database: ${r.rolcreatedb}`);
    console.log(`replication: ${r.rolreplication}`);
    console.log(`bypass RLS: ${r.rolbypassrls}`);

    if (r.rolsuper || r.rolcreaterole || r.rolcreatedb || r.rolreplication || r.rolbypassrls) {
      throw new Error("RUNTIME ROLE GUARD BLOCKED: runtime identity has administrative or RLS-bypass capability.");
    }

    console.log("RUNTIME DB ROLE GUARD: PASS");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error));
  process.exit(1);
});
