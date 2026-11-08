-- Shakti pre-core identity context bootstrap.
-- The core RLS activation migration is ordered before the later platform
-- execution-context migration, so the runtime identity context primitives
-- required by the protected RLS boundary must exist before core activation.

create schema if not exists app;

create or replace function app.set_identity_context(p_identity_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as 'begin
  if p_identity_id is null then
    raise exception ''Identity context requires identity_id'';
  end if;

  if not exists (
    select 1 from identities
     where id = p_identity_id
       and status = ''VERIFIED''
       and suspended_at is null
  ) then
    raise exception ''Identity is not active'';
  end if;

  perform set_config(''app.identity_id'', p_identity_id::text, true);
  perform set_config(''app.execution_scope'', ''IDENTITY'', true);
end;';

create or replace function app.set_platform_context(p_identity_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as 'begin
  if p_identity_id is null then
    raise exception ''Platform context requires identity_id'';
  end if;

  if not exists (
    select 1
      from identities i
      join organization_memberships om
        on om.identity_id = i.id
       and om.status = ''VERIFIED''
      join roles r on r.id = om.role_id
     where i.id = p_identity_id
       and i.status = ''VERIFIED''
       and i.suspended_at is null
       and r.name = ''super_admin''
  ) then
    raise exception ''Identity is not an active Super Admin'';
  end if;

  perform set_config(''app.identity_id'', p_identity_id::text, true);
  perform set_config(''app.execution_scope'', ''PLATFORM'', true);
end;';

grant execute on function app.set_identity_context(uuid) to rupaykg_app_runtime;
grant execute on function app.set_platform_context(uuid) to rupaykg_app_runtime;

comment on function app.set_identity_context(uuid) is
'Shakti pre-core authenticated identity context. Validates active identity and establishes transaction-local IDENTITY scope.';

comment on function app.set_platform_context(uuid) is
'Shakti pre-core platform context bootstrap. Validates active Super Admin authority and establishes transaction-local PLATFORM scope.';
