-- Shakti privileged platform execution context
--
-- Platform administration is an intentional cross-organization privileged
-- surface. It must carry an explicit transaction-local platform identity so
-- future RLS policies can distinguish authorized platform execution from
-- ordinary tenant execution.
create schema if not exists app;

create or replace function app.set_platform_context(p_identity_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if p_identity_id is null then
    raise exception 'Platform context requires identity_id';
  end if;

  if not exists (
    select 1
      from organization_memberships om
      join roles r on r.id = om.role_id
     where om.identity_id = p_identity_id
       and om.status = 'VERIFIED'
       and r.name = 'super_admin'
  ) then
    raise exception 'Identity is not an active Super Admin';
  end if;

  perform set_config('app.identity_id', p_identity_id::text, true);
  perform set_config('app.execution_scope', 'PLATFORM', true);
end;
$$;

grant execute on function app.set_platform_context(uuid) to rupaykg_app_runtime;

comment on function app.set_platform_context(uuid) is
'Shakti privileged execution context. Validates active Super Admin authority and sets transaction-local PLATFORM scope.';
