-- 104: Isolate SECURITY DEFINER execution under a non-login, non-BYPASSRLS owner.
--
-- The owner role is provisioned by the controlled database-administration
-- bootstrap (CI creates it in its disposable cluster). Production provisioning
-- is an explicit DBA prerequisite; this migration does not create/alter login
-- credentials or grant the application runtime membership in this role.
--
-- The role receives SELECT only on the minimum authentication/membership
-- relations and SELECT/INSERT/DELETE on the opaque context-grant table.
-- Narrow SELECT policies are required because organizations and memberships
-- are FORCE RLS under migration 101. The owner is NOLOGIN/NOBYPASSRLS and is
-- not granted to either runtime role.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rupaykg_security_definer') then
    raise exception 'RUPAYKG_SECURITY_DEFINER_OWNER_MISSING: provision the controlled NOLOGIN role before applying migration 104';
  end if;

  if exists (
    select 1 from pg_roles
     where rolname = 'rupaykg_security_definer'
       and (rolsuper or rolbypassrls or rolcanlogin or rolinherit or rolcreatedb or rolcreaterole or rolreplication)
  ) then
    raise exception 'RUPAYKG_SECURITY_DEFINER_OWNER_UNSAFE: owner must be NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and NOREPLICATION';
  end if;

  -- The isolated owner must have no role memberships in either direction:
  -- it cannot inherit/SET ROLE into another role, and no other role can assume it.
  if exists (
    select 1
      from pg_auth_members membership
     where membership.member = 'rupaykg_security_definer'::regrole
        or membership.roleid = 'rupaykg_security_definer'::regrole
  ) then
    raise exception 'RUPAYKG_SECURITY_DEFINER_OWNER_HAS_ROLE_MEMBERSHIPS';
  end if;

  if pg_has_role('rupaykg_app_runtime', 'rupaykg_security_definer', 'MEMBER') then
    raise exception 'RUPAYKG_RUNTIME_CAN_ASSUME_SECURITY_DEFINER_OWNER';
  end if;
end
$$;

grant usage on schema app, public to rupaykg_security_definer;

-- Remove any pre-existing table/column grants before applying the explicit
-- minimum column surface. This makes migration 104 safe for a pre-provisioned
-- role as well as a freshly created disposable CI role.
revoke all on public.identities, public.identity_sessions,
  public.organization_memberships, public.organizations,
  app.request_context_grants from rupaykg_security_definer;

do $privilege_reset$
declare
  privilege_row record;
begin
  for privilege_row in
    select table_schema, table_name, column_name, privilege_type
      from information_schema.column_privileges
     where grantee = 'rupaykg_security_definer'
       and table_schema in ('public', 'app')
       and table_name in (
         'identities', 'identity_sessions', 'organization_memberships',
         'organizations', 'request_context_grants'
       )
  loop
    execute format(
      'revoke %s (%I) on table %I.%I from rupaykg_security_definer',
      privilege_row.privilege_type,
      privilege_row.column_name,
      privilege_row.table_schema,
      privilege_row.table_name
    );
  end loop;
end
$privilege_reset$;

-- Only the columns read by the five SECURITY DEFINER functions are exposed.
grant select (id, status, suspended_at)
  on public.identities to rupaykg_security_definer;
grant select (id, identity_id, token_hash, expires_at, revoked_at)
  on public.identity_sessions to rupaykg_security_definer;
grant select (identity_id, organization_id, role_id, status)
  on public.organization_memberships to rupaykg_security_definer;
grant select (id, status)
  on public.organizations to rupaykg_security_definer;

-- The opaque context-grant table is accessed only by the SECURITY DEFINER
-- functions. No broad table SELECT or INSERT privilege is granted.
grant select (id, identity_id, organization_id, session_id, expires_at),
      insert (identity_id, organization_id, session_id, expires_at),
      delete on app.request_context_grants to rupaykg_security_definer;

-- These are deliberately SELECT-only policies for the isolated function
-- owner. No application role is a member of this owner role.
drop policy if exists shakti_security_definer_membership_read
  on public.organization_memberships;
create policy shakti_security_definer_membership_read
  on public.organization_memberships
  for select to rupaykg_security_definer
  using (true);

drop policy if exists shakti_security_definer_organization_read
  on public.organizations;
create policy shakti_security_definer_organization_read
  on public.organizations
  for select to rupaykg_security_definer
  using (true);

-- PostgreSQL requires CREATE on the containing schema when changing function
-- ownership. Grant it only for this transaction, then revoke it immediately.
grant create on schema app to rupaykg_security_definer;

alter function app.authenticate_bearer_session(text)
  owner to rupaykg_security_definer;
alter function app.set_request_context(uuid, uuid, uuid)
  owner to rupaykg_security_definer;
alter function app.current_identity_id()
  owner to rupaykg_security_definer;
alter function app.current_organization_id()
  owner to rupaykg_security_definer;
alter function app.is_verified_org_member(uuid)
  owner to rupaykg_security_definer;

revoke create on schema app from rupaykg_security_definer;

-- Reassert the intended function ACLs after ownership changes.
revoke all on function app.authenticate_bearer_session(text) from public;
revoke all on function app.set_request_context(uuid, uuid, uuid) from public;
revoke all on function app.current_identity_id() from public;
revoke all on function app.current_organization_id() from public;
revoke all on function app.is_verified_org_member(uuid) from public;

grant execute on function app.authenticate_bearer_session(text) to rupaykg_app_runtime;
grant execute on function app.set_request_context(uuid, uuid, uuid) to rupaykg_app_runtime;
grant execute on function app.current_identity_id() to rupaykg_app_runtime;
grant execute on function app.current_organization_id() to rupaykg_app_runtime;
grant execute on function app.is_verified_org_member(uuid) to rupaykg_app_runtime;

comment on role rupaykg_security_definer is
'NOLOGIN/NOBYPASSRLS owner for narrowly scoped SECURITY DEFINER authentication and tenant-context functions; never grant membership to application roles.';
