-- Signed, short-lived tenant context verifier for database-enforced RLS.
-- SECURITY PREREQUISITE: a DBA must provision rupaykg_security_definer as
-- NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOINHERIT,
-- grant it CREATE on this database, and grant membership only to the migration
-- principal. The application runtime must never be a member of this role.
-- The role owns this schema, key table and SECURITY DEFINER function so the
-- verifier never executes with the broad rupaykg application/database owner.
-- No application-role grants or signing secrets are created by this migration.

DO $$
DECLARE
  owner_role record;
BEGIN
  SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb,
         rolinherit, rolreplication
    INTO owner_role
    FROM pg_roles
   WHERE rolname = 'rupaykg_security_definer';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Required NOLOGIN role rupaykg_security_definer must be provisioned by the DBA before this migration';
  END IF;
  IF owner_role.rolcanlogin OR owner_role.rolsuper OR owner_role.rolbypassrls
     OR owner_role.rolcreaterole OR owner_role.rolcreatedb
     OR owner_role.rolinherit OR owner_role.rolreplication THEN
    RAISE EXCEPTION 'rupaykg_security_definer must be NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOINHERIT and NREPLICATION';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_auth_members m
      JOIN pg_roles owner_membership ON owner_membership.oid = m.member
     WHERE owner_membership.rolname = 'rupaykg_security_definer'
  ) THEN
    RAISE EXCEPTION 'rupaykg_security_definer must not be a member of any other role';
  END IF;
END;
$$;

create schema app_security authorization rupaykg_security_definer;
set local role rupaykg_security_definer;
revoke all on schema app_security from public;


create table app_security.request_context_keys (
  key_id text primary key check (key_id ~ '^[a-z0-9_-]{1,32}$'),
  secret text not null check (octet_length(secret) >= 32),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

revoke all on table app_security.request_context_keys from public;

create or replace function app_security.current_request_context_claims()
returns text[]
language plpgsql
volatile
security definer
set search_path = pg_catalog, app_security
as $$
declare
  raw_context text;
  payload text;
  supplied_signature text;
  parts text[];
  issued_at bigint;
  expires_at bigint;
  now_epoch bigint;
  secret_value text;
begin
  raw_context := current_setting('app.request_context', true);
  if raw_context is null or raw_context = '' then
    return null;
  end if;

  -- Exactly one dot separates the signed payload and its hex signature.
  if length(raw_context) - length(replace(raw_context, '.', '')) <> 1 then
    return null;
  end if;
  payload := split_part(raw_context, '.', 1);
  supplied_signature := split_part(raw_context, '.', 2);
  if payload = '' or supplied_signature !~* '^[0-9a-f]{64}$' then
    return null;
  end if;

  parts := string_to_array(payload, '|');
  if array_length(parts, 1) <> 5 then
    return null;
  end if;
  if parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or parts[3] !~ '^[0-9]{1,12}$'
     or parts[4] !~ '^[0-9]{1,12}$'
     or parts[5] !~ '^[a-z0-9_-]{1,32}$' then
    return null;
  end if;

  issued_at := parts[3]::bigint;
  expires_at := parts[4]::bigint;
  now_epoch := floor(extract(epoch from statement_timestamp()))::bigint;
  if issued_at > now_epoch + 10
     or expires_at <= now_epoch
     or expires_at <= issued_at
     or expires_at - issued_at > 120 then
    return null;
  end if;

  select k.secret
    into secret_value
    from app_security.request_context_keys k
   where k.key_id = parts[5]
     and k.active = true;
  if secret_value is null then
    return null;
  end if;

  if lower(supplied_signature) <> encode(public.hmac(payload, secret_value, 'sha256'), 'hex') then
    return null;
  end if;

  return array[parts[1], parts[2]];
exception
  when others then
    -- Invalid or unverifiable context must never grant a tenant scope.
    return null;
end;
$$;

revoke all on function app_security.current_request_context_claims() from public;
