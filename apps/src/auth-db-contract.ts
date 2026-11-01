import type { Pool } from "pg";

type AuthRoleRow = {
  role_name: string;
  can_login: boolean;
  is_superuser: boolean;
  can_create_db: boolean;
  can_create_role: boolean;
  can_replicate: boolean;
  bypasses_rls: boolean;
  inherits: boolean;
  has_auth_capability: boolean;
  inherits_privileged_role: boolean;
};

export async function assertAuthenticationPoolContract(pool: Pool): Promise<void> {
  const result = await pool.query<AuthRoleRow>(`
    select current_user as role_name,
           r.rolcanlogin as can_login,
           r.rolsuper as is_superuser,
           r.rolcreatedb as can_create_db,
           r.rolcreaterole as can_create_role,
           r.rolreplication as can_replicate,
           r.rolbypassrls as bypasses_rls,
           r.rolinherit as inherits,
           pg_catalog.pg_has_role(current_user, 'rupaykg_auth', 'member') as has_auth_capability,
           exists (
             select 1 from pg_catalog.pg_roles privileged
              where (privileged.rolsuper or privileged.rolcreatedb or privileged.rolcreaterole
                     or privileged.rolreplication or privileged.rolbypassrls)
                and pg_catalog.pg_has_role(current_user, privileged.oid, 'member')
           ) as inherits_privileged_role
      from pg_catalog.pg_roles r
     where r.rolname = current_user
  `);
  const role = result.rows[0];
  if (!role
      || !role.can_login
      || role.is_superuser
      || role.can_create_db
      || role.can_create_role
      || role.can_replicate
      || role.bypasses_rls
      || !role.inherits
      || !role.has_auth_capability
      || role.inherits_privileged_role) {
    throw new Error("AUTH_DATABASE_ROLE_INVALID: login must inherit only the rupaykg_auth capability and must not hold elevated privileges or BYPASSRLS");
  }
  const verifier = await pool.query<{ identity_id: string | null }>(
    "select public.verify_identity_session(repeat('0', 64)) as identity_id",
  );
  if (verifier.rows.length !== 1 || verifier.rows[0]?.identity_id !== null) {
    throw new Error("AUTH_DATABASE_VERIFIER_INVALID: restricted session verifier did not return the expected empty result");
  }
}
