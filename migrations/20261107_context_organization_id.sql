-- Shakti tenant execution context accessors.
-- These functions are transaction-local and validate the authenticated
-- identity/organization boundary before establishing tenant context.

create schema if not exists app;

create or replace function app.current_identity_id()
returns uuid
language sql
security definer
stable
set search_path = public, app
as 'select nullif(current_setting(''app.identity_id'', true), '''')::uuid';

create or replace function app.current_organization_id()
returns uuid
language sql
security definer
stable
set search_path = public, app
as 'select nullif(current_setting(''app.organization_id'', true), '''')::uuid';

create or replace function app.set_request_context(
  p_identity_id uuid,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, app
as 'begin
  if p_identity_id is null or p_organization_id is null then
    raise exception ''Tenant context requires identity_id and organization_id'';
  end if;

  if not exists (
    select 1
      from identities i
     where i.id = p_identity_id
       and i.status = ''VERIFIED''
       and i.suspended_at is null
  ) then
    raise exception ''Identity is not active'';
  end if;

  if not exists (
    select 1
      from organization_memberships om
      join organizations o
        on o.id = om.organization_id
       and o.status = ''VERIFIED''
     where om.identity_id = p_identity_id
       and om.organization_id = p_organization_id
       and om.status = ''VERIFIED''
  ) then
    raise exception ''Identity does not have verified membership in the requested organization'';
  end if;

  perform set_config(''app.identity_id'', p_identity_id::text, true);
  perform set_config(''app.organization_id'', p_organization_id::text, true);
  perform set_config(''app.execution_scope'', ''TENANT'', true);
end;';

grant execute on function app.current_identity_id() to rupaykg_app_runtime;
grant execute on function app.current_organization_id() to rupaykg_app_runtime;
grant execute on function app.set_request_context(uuid,uuid) to rupaykg_app_runtime;

comment on function app.current_identity_id() is
'Shakti transaction-local identity accessor. Returns NULL when no identity context is established.';

comment on function app.current_organization_id() is
'Shakti tenant RLS accessor. Returns NULL when no tenant context is established.';

comment on function app.set_request_context(uuid,uuid) is
'Shakti tenant execution context. Validates active identity and verified organization membership before setting transaction-local tenant scope.';
