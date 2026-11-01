-- Signed, short-lived tenant context verifier for database-enforced RLS.
-- The key store and verifier are inert until a dedicated NOBYPASSRLS runtime
-- role is provisioned and explicitly granted schema USAGE + function EXECUTE.

create schema app_security;
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
