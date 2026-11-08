-- Shakti RLS-compatible authentication/bootstrap path.
--
-- Authentication must resolve a bearer session and its verified memberships
-- before tenant context exists. This SECURITY DEFINER function is the
-- explicitly governed bootstrap boundary required for RLS-compatible auth.

create or replace function app.authenticate_bearer_session(
  p_token_hash text
)
returns table (
  identity_id uuid,
  organization_id uuid,
  role_id uuid,
  status text
)
language sql
stable
security definer
set search_path = pg_catalog, public, app
as $$
  select
    s.identity_id,
    om.organization_id,
    om.role_id,
    om.status
  from identity_sessions s
  join identities i on i.id = s.identity_id
  join organization_memberships om on om.identity_id = s.identity_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and i.status = 'VERIFIED'
    and i.suspended_at is null
    and om.status = 'VERIFIED'
$$;

revoke all on function app.authenticate_bearer_session(text) from public;
grant execute on function app.authenticate_bearer_session(text) to rupaykg_app_runtime;

comment on function app.authenticate_bearer_session(text) is
'Shakti authentication bootstrap: resolves only verified memberships attached to a valid bearer session. SECURITY DEFINER is the explicit pre-tenant-context boundary required for RLS-compatible authentication.';
