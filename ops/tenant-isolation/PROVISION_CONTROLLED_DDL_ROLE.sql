-- Shakti controlled DDL-role provisioning plan
-- MANUAL / APPROVAL-GATED ONLY.
-- This file is intentionally NOT executed by any GitHub Actions workflow.
--
-- Purpose:
--   Provision a dedicated, non-BYPASSRLS controlled migration role while
--   leaving the application runtime login unchanged before Shakti 097-099 and RLS
--   activation are executed.
--
-- Required operator inputs:
--   1. Execute as the currently authorized production owner/admin.
--   2. Set a strong password for the new LOGIN role outside source control.
--   3. Verify the target endpoint before execution.
--   4. Preserve all output as change evidence.
--
-- Safety:
--   - refuses execution if the requested role already exists;
--   - refuses execution if any protected table is missing;
--   - permits the existing authorized table owner/admin to perform this one-time
--     ownership transfer; the provisioned migration role itself is strictly
--     non-SUPERUSER/non-BYPASSRLS;
--   - refuses execution if the expected runtime role is missing;
--   - this script must be run by an explicitly authorized provisioning administrator.
--   - does NOT enable RLS.
--   - does NOT modify application data.
--
-- IMPORTANT:
--   The role name below is the canonical controlled migration login expected
--   by the Shakti production workflow. Change it only through a reviewed
--   repository change.

do $$
declare
  v_role constant name := 'rupaykg_ddl_migration';
  v_protected constant text[] := array[
    'organizations','roles','activities','obligations','credentials',
    'settlements','audit_events','resource_flows','field_devices',
    'organization_memberships','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links'
  ];
  v_missing integer;
  v_owned integer;
begin
  if current_user = 'rupaykg_app_runtime' then
    raise exception 'DDL_ROLE_PROVISIONING_BLOCKED: provisioning administrator cannot be the application runtime role';
  end if;

  if coalesce((select rolsuper from pg_roles where rolname = current_user), true)
     or coalesce((select rolbypassrls from pg_roles where rolname = current_user), true) then
    raise exception 'DDL_ROLE_PROVISIONING_BLOCKED: provisioning administrator must be explicitly governed and non-BYPASSRLS/non-SUPERUSER';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'rupaykg_app_runtime') then
    raise exception 'DDL_ROLE_PROVISIONING_BLOCKED: expected runtime role rupaykg_app_runtime is missing';
  end if;

  if exists (select 1 from pg_roles where rolname = v_role) then
    raise exception 'DDL_ROLE_PROVISIONING_BLOCKED: role % already exists; use the verification/rotation procedure instead', v_role;
  end if;

  select count(*) into v_missing
    from unnest(v_protected) p(table_name)
   where not exists (
     select 1
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = p.table_name
        and c.relkind = 'r'
   );

  if v_missing <> 0 then
    raise exception 'DDL_ROLE_PROVISIONING_BLOCKED: protected-table inventory is incomplete; missing=%', v_missing;
  end if;

  select count(*) into v_owned
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any(v_protected)
     and pg_get_userbyid(c.relowner) = current_user;

  if v_owned <> 17 then
    raise exception 'DDL_ROLE_PROVISIONING_BLOCKED: current provisioning administrator does not own all 17 protected tenant tables; owned=%', v_owned;
  end if;

  raise notice 'PROVISIONING PRECHECK PASS: authorized current owner/admin=%, current_bypassrls=%, protected_tables_owned=17; target role will be non-BYPASSRLS', current_user, (select rolbypassrls from pg_roles where rolname = current_user);
end $$;

-- Create a dedicated non-BYPASSRLS migration/DDL login.
-- Set the password through the approved secret-management/change process;
-- never commit a password to this repository.
create role rupaykg_ddl_migration
  login
  nosuperuser
  nocreatedb
  nocreaterole
  noinherit
  nobypassrls;

-- The DDL role is allowed to SET ROLE to the runtime role for the
-- rollback-safe tenant-isolation negative acceptance test.
grant rupaykg_app_runtime to rupaykg_ddl_migration;

-- Transfer ownership of the protected tenant tables to the dedicated DDL role.
alter table organizations owner to rupaykg_ddl_migration;
alter table roles owner to rupaykg_ddl_migration;
alter table activities owner to rupaykg_ddl_migration;
alter table obligations owner to rupaykg_ddl_migration;
alter table credentials owner to rupaykg_ddl_migration;
alter table settlements owner to rupaykg_ddl_migration;
alter table audit_events owner to rupaykg_ddl_migration;
alter table resource_flows owner to rupaykg_ddl_migration;
alter table field_devices owner to rupaykg_ddl_migration;
alter table organization_memberships owner to rupaykg_ddl_migration;
alter table measurements owner to rupaykg_ddl_migration;
alter table evidence owner to rupaykg_ddl_migration;
alter table verifications owner to rupaykg_ddl_migration;
alter table carbon_calculations owner to rupaykg_ddl_migration;
alter table mrv_observations owner to rupaykg_ddl_migration;
alter table evidence_verification_requirements owner to rupaykg_ddl_migration;
alter table chain_of_custody_links owner to rupaykg_ddl_migration;

-- Verification. This is intentionally fail-closed.
select 1 / case
  when (select rolsuper from pg_roles where rolname='rupaykg_ddl_migration') = false
   and (select rolbypassrls from pg_roles where rolname='rupaykg_ddl_migration') = false
   and (
     select count(*)
       from pg_class c
       join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname in (
          'organizations','roles','activities','obligations','credentials',
          'settlements','audit_events','resource_flows','field_devices',
          'organization_memberships','measurements','evidence','verifications',
          'carbon_calculations','mrv_observations',
          'evidence_verification_requirements','chain_of_custody_links'
        )
        and pg_get_userbyid(c.relowner)='rupaykg_ddl_migration'
   ) = 17
  then 1 else 0 end as ddl_role_provisioning_assertion;

-- RLS is intentionally NOT enabled here.
-- Next controlled steps:
--   1. Apply migrations 097-099 using rupaykg_ddl_migration.
--   2. Run VERIFY_DDL_ROLE_PRE_RLS.sql.
--   3. Run VERIFY_PRE_RLS.sql using the exact application runtime login.
--   4. Run authentication/security-definer/policy-coverage gates.
--   5. Only then execute ACTIVATE_RLS.sql.

-- Rollback note (manual, approval-gated): if provisioning must be reversed before
-- any Shakti migration/RLS activation, restore ownership of the 17 protected tables
-- to the previously authorized owner using an approved change procedure. Do not
-- drop the new role while it still owns objects or is referenced by the workflow.
-- RLS must remain disabled during this role-provisioning rollback unless a separate
-- approved rollback procedure explicitly governs RLS state.
