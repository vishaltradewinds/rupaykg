-- 103: Bind tenant request context to a database-issued bearer-session grant.
--
-- PostgreSQL custom GUCs are directly settable by any session. A policy that
-- trusts app.identity_id + app.organization_id alone can therefore be spoofed
-- by a compromised runtime DB session. This migration introduces an opaque,
-- short-lived grant minted only by the SECURITY DEFINER bearer-session
-- bootstrap and required by the request-context setter and RLS context
-- readers. The runtime role cannot read or write the grant table.
--
-- No production credentials or login attributes are created or changed.

create table if not exists app.request_context_grants (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.identities(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.identity_sessions(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists request_context_grants_expires_at_idx
  on app.request_context_grants (expires_at);

revoke all on table app.request_context_grants from public;
revoke all on table app.request_context_grants from rupaykg_app_runtime;

-- Replace the old four-column authentication result with a session-bound
-- opaque grant for each verified membership. The raw bearer token is never
-- stored; the existing SHA-256 token hash remains the lookup key.
drop function if exists app.authenticate_bearer_session(text);

create function app.authenticate_bearer_session(p_token_hash text)
returns table (
  identity_id uuid,
  organization_id uuid,
  role_id uuid,
  status text,
  context_token uuid
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, app
as $$
begin
  delete from app.request_context_grants
   where expires_at <= now();

  return query
  with valid_session as materialized (
    select s.id as session_id, s.identity_id, s.expires_at as session_expires_at
      from public.identity_sessions s
      join public.identities i on i.id = s.identity_id
     where s.token_hash = p_token_hash
       and s.revoked_at is null
       and s.expires_at > now()
       and i.status = 'VERIFIED'
       and i.suspended_at is null
  ),
  verified_memberships as materialized (
    select vs.session_id, vs.identity_id, vs.session_expires_at,
           om.organization_id, om.role_id, om.status
      from valid_session vs
      join public.organization_memberships om on om.identity_id = vs.identity_id
      join public.organizations o on o.id = om.organization_id
     where om.status = 'VERIFIED'
       and o.status = 'VERIFIED'
  ),
  issued_grants as (
    insert into app.request_context_grants as grant_row (
      identity_id, organization_id, session_id, expires_at
    )
    select vm.identity_id, vm.organization_id, vm.session_id,
           least(vm.session_expires_at, now() + interval '2 minutes')
      from verified_memberships vm
    returning grant_row.id, grant_row.identity_id, grant_row.organization_id
  )
  select vm.identity_id, vm.organization_id, vm.role_id, vm.status, ig.id
    from verified_memberships vm
    join issued_grants ig
      on ig.identity_id = vm.identity_id
     and ig.organization_id = vm.organization_id;
end;
$$;

revoke all on function app.authenticate_bearer_session(text) from public;
grant execute on function app.authenticate_bearer_session(text) to rupaykg_app_runtime;

-- RLS context readers validate the opaque grant inline. They are SECURITY
-- DEFINER so the runtime role never needs direct access to the private grant
-- table. Keeping validation inline avoids a second function ACL edge.

create or replace function app.current_identity_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, app
as $$
  select case when exists (
    select 1
      from app.request_context_grants g
      join public.identity_sessions s on s.id = g.session_id
      join public.identities i on i.id = g.identity_id
      join public.organizations o on o.id = g.organization_id
      join public.organization_memberships om
        on om.identity_id = g.identity_id
       and om.organization_id = g.organization_id
     where g.id = nullif(current_setting('app.context_token', true), '')::uuid
       and g.identity_id = nullif(current_setting('app.identity_id', true), '')::uuid
       and g.organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
       and g.expires_at > now()
       and s.revoked_at is null
       and s.expires_at > now()
       and i.status = 'VERIFIED'
       and i.suspended_at is null
       and o.status = 'VERIFIED'
       and om.status = 'VERIFIED'
  )
  then nullif(current_setting('app.identity_id', true), '')::uuid
  else null end
$$;

create or replace function app.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, app
as $$
  select case when exists (
    select 1
      from app.request_context_grants g
      join public.identity_sessions s on s.id = g.session_id
      join public.identities i on i.id = g.identity_id
      join public.organizations o on o.id = g.organization_id
      join public.organization_memberships om
        on om.identity_id = g.identity_id
       and om.organization_id = g.organization_id
     where g.id = nullif(current_setting('app.context_token', true), '')::uuid
       and g.identity_id = nullif(current_setting('app.identity_id', true), '')::uuid
       and g.organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
       and g.expires_at > now()
       and s.revoked_at is null
       and s.expires_at > now()
       and i.status = 'VERIFIED'
       and i.suspended_at is null
       and o.status = 'VERIFIED'
       and om.status = 'VERIFIED'
  )
  then nullif(current_setting('app.organization_id', true), '')::uuid
  else null end
$$;

revoke all on function app.current_identity_id() from public;
revoke all on function app.current_organization_id() from public;
grant execute on function app.current_identity_id() to rupaykg_app_runtime;
grant execute on function app.current_organization_id() to rupaykg_app_runtime;

-- Remove the old membership-only setter: it accepted a caller-selected
-- identity and organization without proving a bearer-session bootstrap.
drop function if exists app.set_request_context(uuid, uuid);

create function app.set_request_context(
  p_identity_id uuid,
  p_organization_id uuid,
  p_context_token uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app
as $$
begin
  if p_identity_id is null or p_organization_id is null or p_context_token is null then
    raise exception 'Authenticated tenant context requires identity, organization and context token';
  end if;

  if not exists (
    select 1
      from app.request_context_grants g
      join public.identity_sessions s on s.id = g.session_id
      join public.identities i on i.id = g.identity_id
      join public.organizations o on o.id = g.organization_id
      join public.organization_memberships om
        on om.identity_id = g.identity_id
       and om.organization_id = g.organization_id
     where g.id = p_context_token
       and g.identity_id = p_identity_id
       and g.organization_id = p_organization_id
       and g.expires_at > now()
       and s.revoked_at is null
       and s.expires_at > now()
       and i.status = 'VERIFIED'
       and i.suspended_at is null
       and o.status = 'VERIFIED'
       and om.status = 'VERIFIED'
  ) then
    raise exception 'Authenticated request context grant is invalid, expired, revoked or outside verified membership';
  end if;

  perform set_config('app.identity_id', p_identity_id::text, true);
  perform set_config('app.organization_id', p_organization_id::text, true);
  perform set_config('app.context_token', p_context_token::text, true);
end;
$$;

revoke all on function app.set_request_context(uuid, uuid, uuid) from public;
grant execute on function app.set_request_context(uuid, uuid, uuid) to rupaykg_app_runtime;

comment on table app.request_context_grants is
'Private, short-lived grants minted by app.authenticate_bearer_session and required to establish RLS tenant context. Runtime role has no direct table privileges.';
comment on function app.set_request_context(uuid, uuid, uuid) is
'Sets transaction-local tenant context only when the opaque grant was minted by the bearer-session authentication bootstrap.';
