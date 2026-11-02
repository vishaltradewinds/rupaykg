import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const ssl = process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false };

test("application trigger functions are bound to triggers and not directly executable by PUBLIC", { skip: !databaseUrl }, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl });
  try {
    const result = await pool.query<{
      trigger_functions: string;
      unbound_trigger_functions: string;
      public_executable_trigger_functions: string;
    }>(
      `select
         count(*)::text as trigger_functions,
         count(*) filter (
           where not exists (
             select 1 from pg_catalog.pg_trigger t
              where t.tgfoid=p.oid and not t.tgisinternal
           )
         )::text as unbound_trigger_functions,
         count(*) filter (
           where exists (
             select 1 from pg_catalog.aclexplode(
               coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))
             ) a where a.grantee=0 and a.privilege_type='EXECUTE'
           )
         )::text as public_executable_trigger_functions
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public'
         and p.prokind='f'
         and p.prorettype='pg_catalog.trigger'::pg_catalog.regtype
         and not exists (
           select 1 from pg_catalog.pg_depend d
            where d.classid='pg_catalog.pg_proc'::regclass
              and d.objid=p.oid and d.deptype='e'
         )`,
    );
    const row=result.rows[0]!;
    assert.ok(Number(row.trigger_functions)>0, "expected application trigger functions");
    assert.equal(row.unbound_trigger_functions,"0","every application trigger function must be attached to a non-internal trigger");
    assert.equal(row.public_executable_trigger_functions,"0","PUBLIC must not directly execute application trigger functions");
  } finally {
    await pool.end();
  }
});
