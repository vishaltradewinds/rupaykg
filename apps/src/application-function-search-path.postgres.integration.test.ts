import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const ssl = process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false };

test("application-owned public routines have a pinned safe search_path", { skip: !databaseUrl }, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl });
  try {
    const result = await pool.query<{ total: string; unpinned: string; wrong_path: string; public_create: boolean }>(
      `select
         count(*)::text as total,
         count(*) filter (
           where p.proconfig is null
              or not ('search_path=pg_catalog, public, pg_temp'=any(p.proconfig))
         )::text as unpinned,
         count(*) filter (
           where p.proconfig is not null
             and not ('search_path=pg_catalog, public, pg_temp'=any(p.proconfig))
         )::text as wrong_path,
         has_schema_privilege('public','public','CREATE') as public_create
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public'
         and p.prokind in ('f','p')
         and not exists (
           select 1 from pg_catalog.pg_depend d
            where d.classid='pg_catalog.pg_proc'::regclass
              and d.objid=p.oid and d.deptype='e'
         )`,
    );
    assert.ok(Number(result.rows[0]!.total) > 0, "expected application-owned public routines");
    assert.equal(result.rows[0]!.unpinned, "0", "all application-owned routines must have an explicit pinned search_path");
    assert.equal(result.rows[0]!.wrong_path, "0", "routine search_path must match the reviewed safe order");
    assert.equal(result.rows[0]!.public_create, false, "PUBLIC must not be able to CREATE in public schema");
  } finally {
    await pool.end();
  }
});
