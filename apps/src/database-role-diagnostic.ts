import type { Pool } from "pg";

export type DatabaseRoleDiagnostic = {
  current_user: string;
  session_user: string;
  is_superuser: boolean;
  bypasses_rls: boolean;
  can_create_roles: boolean;
  can_create_databases: boolean;
  can_create_in_public_schema: boolean;
  can_delete_verifications: boolean;
  can_truncate_verifications: boolean;
  can_trigger_verifications: boolean;
};

/**
 * Read-only, non-secret privilege diagnostic.
 * Never returns connection strings, passwords, environment values or row data.
 */
export async function readDatabaseRoleDiagnostic(pool: Pool): Promise<DatabaseRoleDiagnostic> {
  const result = await pool.query<DatabaseRoleDiagnostic>(`
    select
      current_user::text as current_user,
      session_user::text as session_user,
      coalesce(r.rolsuper, false) as is_superuser,
      coalesce(r.rolbypassrls, false) as bypasses_rls,
      coalesce(r.rolcreaterole, false) as can_create_roles,
      coalesce(r.rolcreatedb, false) as can_create_databases,
      has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public_schema,
      case when to_regclass('public.verifications') is null then false
        else has_table_privilege(current_user, 'public.verifications', 'DELETE') end as can_delete_verifications,
      case when to_regclass('public.verifications') is null then false
        else has_table_privilege(current_user, 'public.verifications', 'TRUNCATE') end as can_truncate_verifications,
      case when to_regclass('public.verifications') is null then false
        else has_table_privilege(current_user, 'public.verifications', 'TRIGGER') end as can_trigger_verifications
    from pg_roles r
    where r.rolname = current_user
  `);
  if (!result.rows[0]) throw new Error("DATABASE_ROLE_DIAGNOSTIC_NO_CURRENT_ROLE");
  return result.rows[0];
}
