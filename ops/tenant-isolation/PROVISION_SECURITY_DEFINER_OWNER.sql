-- DBA-only preflight/provisioning for migration 104.
-- Run only against the intended database after reviewing the change window.
-- This creates a NOLOGIN role only; it creates no credentials and grants no
-- membership to the application runtime. Do not run against production without
-- the approved change record and rollback plan.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rupaykg_security_definer') then
    execute 'create role rupaykg_security_definer nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication';
  end if;
end
$$;

select
  rolname,
  rolcanlogin,
  rolinherit,
  rolsuper,
  rolbypassrls,
  rolcreatedb,
  rolcreaterole,
  rolreplication
from pg_roles
where rolname = 'rupaykg_security_definer';

select 1 / case
  when exists (
    select 1
    from pg_roles
    where rolname = 'rupaykg_security_definer'
      and not rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolbypassrls
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
  )
  then 1
  else 0
end as isolated_owner_role_preflight;

-- The following must remain false. Never grant the owner role to app runtime.
select
  pg_has_role('rupaykg_app_runtime', 'rupaykg_security_definer', 'MEMBER')
    as app_runtime_can_assume_security_definer,
  pg_has_role('rupaykg_runtime_login', 'rupaykg_security_definer', 'MEMBER')
    as runtime_login_can_assume_security_definer;
