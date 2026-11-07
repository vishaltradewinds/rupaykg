create schema if not exists app;

create or replace function app.set_authority_context(
  p_identity_id uuid,
  p_authority_level text,
  p_geography_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  allowed boolean := false;
begin
  if p_identity_id is null or p_authority_level is null then
    raise exception 'Authority context requires identity and level';
  end if;

  if p_authority_level = 'PLATFORM' then
    select exists (
      select 1 from organization_memberships om
      join roles r on r.id = om.role_id
      where om.identity_id = p_identity_id
        and om.status = 'VERIFIED'
        and r.name in ('platform_admin','super_admin')
    ) into allowed;
  elsif p_authority_level = 'STATE' then
    select exists (
      select 1 from organization_memberships om
      join roles r on r.id = om.role_id
      where om.identity_id = p_identity_id
        and om.status = 'VERIFIED'
        and r.name in ('state_admin','regulator')
        and (p_geography_id is null or organization_has_geography_scope(om.organization_id,p_geography_id))
    ) into allowed;
  elsif p_authority_level = 'DISTRICT' then
    select exists (
      select 1 from organization_memberships om
      join roles r on r.id = om.role_id
      where om.identity_id = p_identity_id
        and om.status = 'VERIFIED'
        and r.name in ('regulator','state_admin')
        and (p_geography_id is null or organization_has_geography_scope(om.organization_id,p_geography_id))
    ) into allowed;
  elsif p_authority_level = 'LOCAL' then
    select exists (
      select 1 from organization_memberships om
      join roles r on r.id = om.role_id
      where om.identity_id = p_identity_id
        and om.status = 'VERIFIED'
        and r.name in ('municipal_admin','regulator')
        and (p_geography_id is null or organization_has_geography_scope(om.organization_id,p_geography_id))
    ) into allowed;
  end if;

  if not allowed then
    raise exception 'Identity is not authorized for the requested authority context';
  end if;

  perform set_config('app.identity_id', p_identity_id::text, true);
  perform set_config('app.execution_scope', p_authority_level, true);
  perform set_config('app.authority_geography_id', coalesce(p_geography_id::text,''), true);
end;
$$;

grant execute on function app.set_authority_context(uuid,text,uuid) to rupaykg_app_runtime;

comment on function app.set_authority_context(uuid,text,uuid) is
'Shakti least-privilege hierarchy context. Validates authority role and optional geography scope, then sets transaction-local execution scope.';
