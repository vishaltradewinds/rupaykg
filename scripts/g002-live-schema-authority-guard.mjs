import crypto from "node:crypto";
import process from "node:process";

const EXPECTED = process.env.LIVE_SCHEMA_BASELINE_HASH;
if (!EXPECTED) throw new Error("SCHEMA AUTHORITY GUARD BLOCKED: LIVE_SCHEMA_BASELINE_HASH is not set.");

const SQL = `
WITH objects AS (
  SELECT 'column' AS object_type, table_name AS object_name, column_name AS attribute_name,
         data_type || ':' || COALESCE(is_nullable, '') AS definition
  FROM information_schema.columns WHERE table_schema = 'public'
  UNION ALL
  SELECT 'constraint', tc.table_name, tc.constraint_name, tc.constraint_type
  FROM information_schema.table_constraints tc WHERE tc.table_schema = 'public'
  UNION ALL
  SELECT 'index', schemaname || '.' || tablename, indexname, indexdef
  FROM pg_indexes WHERE schemaname = 'public'
  UNION ALL
  SELECT 'routine', routine_name, routine_type,
         COALESCE(data_type, '') || ':' || COALESCE(routine_definition, '')
  FROM information_schema.routines WHERE routine_schema = 'public'
  UNION ALL
  SELECT 'trigger', event_object_table, trigger_name,
         action_timing || ':' || event_manipulation || ':' || action_statement
  FROM information_schema.triggers WHERE trigger_schema = 'public'
  UNION ALL
  SELECT 'enum', t.typname, e.enumlabel, e.enumsortorder::text
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
)
SELECT object_type, object_name, attribute_name, definition
FROM objects
ORDER BY object_type, object_name, attribute_name, definition
`;

async function main() {
  const { Pool } = await import("pg");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("SCHEMA AUTHORITY GUARD BLOCKED: DATABASE_URL is not configured.");

  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(SQL);
    const canonical = rows.map(r => [r.object_type, r.object_name, r.attribute_name, r.definition].join("|")).join("\n");
    const actual = crypto.createHash("sha256").update(canonical).digest("hex");

    console.log("=== RUPAYKG G-002 LIVE SCHEMA AUTHORITY GUARD ===");
    console.log(`metadata rows: ${rows.length}`);
    console.log(`expected hash: ${EXPECTED}`);
    console.log(`actual hash:   ${actual}`);

    if (actual !== EXPECTED) {
      throw new Error("SCHEMA AUTHORITY GUARD BLOCKED: live structural metadata does not match the declared baseline.");
    }
    console.log("SCHEMA AUTHORITY GUARD: PASS");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error));
  process.exit(1);
});
