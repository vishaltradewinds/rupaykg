-- Shakti production DDL/runtime ownership separation.
-- Gate: PREPARED ONLY. Do not execute until the production change window
-- and explicit activation authority are present.
--
-- Safety contract:
--   * must run as the current privileged DDL owner/admin, never app runtime
--   * refuses to run if a protected table is unexpectedly absent
--   * refuses to run if any protected table has an unexpected owner
--   * does not enable RLS
--   * does not change runtime credentials
--   * ownership transfer is the only production mutation in this gate

do $shakti$
declare
  protected_tables text[] := array[
    'organizations','roles','activities','obligations','credentials',
    'settlements','audit_events','resource_flows','field_devices',
    'organization_memberships','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links'
  ];
  t text;
  actual_owner text;
begin
  if current_user = 'rupaykg_app_runtime' or current_user = 'rupaykg_runtime_login' then
    raise exception 'SHakti abort: runtime role cannot perform DDL ownership migration';
  end if;

  if not exists (
    select 1 from pg_roles
    where rolname = 'rupaykg_ddl'
      and rolsuper = false
      and rolbypassrls = false
      and rolcanlogin = false
  ) then
    if exists (select 1 from pg_roles where rolname = 'rupaykg_ddl') then
      raise exception 'SHakti abort: existing rupaykg_ddl role has unexpected attributes';
    end if;

    create role rupaykg_ddl
      nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;

  foreach t in array protected_tables loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = t
        and c.relkind = 'r'
    ) then
      raise exception 'SHakti abort: protected table public.% is missing', t;
    end if;

    select pg_get_userbyid(c.relowner)
      into actual_owner
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = t;

    if actual_owner <> current_user and actual_owner <> 'rupaykg_ddl' then
      raise exception 'SHakti abort: unexpected owner for public.%: %', t, actual_owner;
    end if;
  end loop;
end
$shakti$;

alter table organizations owner to rupaykg_ddl;
alter table roles owner to rupaykg_ddl;
alter table activities owner to rupaykg_ddl;
alter table obligations owner to rupaykg_ddl;
alter table credentials owner to rupaykg_ddl;
alter table settlements owner to rupaykg_ddl;
alter table audit_events owner to rupaykg_ddl;
alter table resource_flows owner to rupaykg_ddl;
alter table field_devices owner to rupaykg_ddl;
alter table organization_memberships owner to rupaykg_ddl;
alter table measurements owner to rupaykg_ddl;
alter table evidence owner to rupaykg_ddl;
alter table verifications owner to rupaykg_ddl;
alter table carbon_calculations owner to rupaykg_ddl;
alter table mrv_observations owner to rupaykg_ddl;
alter table evidence_verification_requirements owner to rupaykg_ddl;
alter table chain_of_custody_links owner to rupaykg_ddl;