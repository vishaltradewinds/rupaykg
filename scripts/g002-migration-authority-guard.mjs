import fs from "node:fs";
import path from "node:path";
import process from "node:process";

async function main() {
  const { Pool } = await import("pg");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("MIGRATION AUTHORITY BLOCKED: DATABASE_URL is not configured.");

  const journalPath = path.resolve("drizzle/meta/_journal.json");
  let journalCount = 0;
  if (fs.existsSync(journalPath)) {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    if (!Array.isArray(journal.entries)) throw new Error("MIGRATION AUTHORITY BLOCKED: malformed Drizzle journal.");
    journalCount = journal.entries.length;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(`
      SELECT current_database() AS database_name,
             current_user AS current_user,
             to_regclass('public.schema_migrations') AS custom_ledger,
             to_regclass('drizzle.__drizzle_migrations') AS drizzle_ledger
    `);
    const r = rows[0];
    const customLedger = Boolean(r.custom_ledger);
    const drizzleLedger = Boolean(r.drizzle_ledger);

    console.log("=== RUPAYKG G-002 MIGRATION AUTHORITY GUARD ===");
    console.log(`database: ${r.database_name}`);
    console.log(`connected role: ${r.current_user}`);
    console.log(`repo Drizzle journal entries: ${journalCount}`);
    console.log(`public.schema_migrations: ${customLedger ? "PRESENT" : "ABSENT"}`);
    console.log(`drizzle.__drizzle_migrations: ${drizzleLedger ? "PRESENT" : "ABSENT"}`);

    if (customLedger && !drizzleLedger && process.env.MIGRATION_AUTHORITY_RECONCILED !== "true") {
      throw new Error("MIGRATION AUTHORITY BLOCKED: custom production ledger exists without a Drizzle ledger; reconcile authority before applying migrations.");
    }
    if (customLedger && process.env.MIGRATION_AUTHORITY_RECONCILED !== "true") {
      throw new Error("MIGRATION AUTHORITY BLOCKED: explicit MIGRATION_AUTHORITY_RECONCILED=true is required after evidence-backed reconciliation.");
    }
    if (!customLedger && !drizzleLedger) {
      throw new Error("MIGRATION AUTHORITY BLOCKED: no recognized migration ledger exists in target database.");
    }
    if (drizzleLedger && journalCount === 0) {
      throw new Error("MIGRATION AUTHORITY BLOCKED: repository Drizzle journal is empty while a Drizzle ledger exists.");
    }

    console.log("MIGRATION AUTHORITY GUARD: PASS");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error));
  process.exit(1);
});
