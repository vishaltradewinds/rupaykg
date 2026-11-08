-- Shakti tenant-isolation runtime contract.
--
-- Establishes the database primitives required for fail-closed tenant
-- isolation. RLS activation remains a deployment gate and is intentionally
-- not performed here.

create schema if not exists app;

create or replace function app.current_identity_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.identity_id', true), '')::uuid
$$;

create or replace function app.current_organization_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.organization_id', true), '')::uuid
$$;

create or replace function app.set_request_context(
  p_identity_id uuid,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app
as $$
begin
  if p_identity_id is null or p_organization_id is null then
    raise exception 'Tenant request context requires identity_id and organization_id';
  end if;

  if not exists (
    select 1
      from organization_memberships om
     where om.identity_id = p_identity_id
       and om.organization_id = p_organization_id
       and om.status = 'VERIFIED'
  ) then
    raise exception 'Identity is not a verified member of the requested organization';
  end if;

  perform set_config('app.identity_id', p_identity_id::text, true);
  perform set_config('app.organization_id', p_organization_id::text, true);
end;
$$;

comment on function app.current_identity_id() is
'Shakti tenant-isolation context: returns the transaction-local authenticated identity.';
comment on function app.current_organization_id() is
'Shakti tenant-isolation context: returns the transaction-local active organization.';
comment on function app.set_request_context(uuid,uuid) is
'Fail-closed tenant context setter. Validates verified membership before setting transaction-local context.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rupaykg_app_runtime') then
    create role rupaykg_app_runtime nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

revoke all on function app.set_request_context(uuid,uuid) from public;

grant usage on schema app to rupaykg_app_runtime;
grant execute on function app.current_identity_id() to rupaykg_app_runtime;
grant execute on function app.current_organization_id() to rupaykg_app_runtime;
grant execute on function app.set_request_context(uuid,uuid) to rupaykg_app_runtime;
