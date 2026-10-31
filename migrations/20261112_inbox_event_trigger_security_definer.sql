-- Keep worker identities from inserting audit rows directly while allowing the
-- inbox state-transition trigger to append its payload-free event record.
-- The owner is a dedicated NOLOGIN capability role, not the web/application owner.
do $$
begin
  if not exists (select 1 from pg_roles where rolname='rupaykg_inbox_event_writer') then
    execute 'create role rupaykg_inbox_event_writer nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls';
  end if;
end
$$;

grant usage on schema public to rupaykg_inbox_event_writer;
grant insert on table public.async_mirror_inbox_events to rupaykg_inbox_event_writer;
grant usage on sequence public.async_mirror_inbox_events_id_seq to rupaykg_inbox_event_writer;

-- PostgreSQL requires the new owner to have CREATE on the containing schema
-- during ownership transfer. Grant temporarily, transfer ownership, then revoke.
grant create on schema public to rupaykg_inbox_event_writer;
grant rupaykg_inbox_event_writer to current_user with admin false, inherit false, set true;

create or replace function public.record_async_mirror_inbox_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if TG_OP = 'INSERT' or old.status is distinct from new.status or old.attempts is distinct from new.attempts then
    insert into public.async_mirror_inbox_events
      (inbox_id, authority_code, municipal_code, batch_id, from_status, to_status, attempt, payload_sha256, error_code)
    values
      (new.id, new.authority_code, new.municipal_code, new.batch_id,
       case when TG_OP = 'INSERT' then null else old.status end,
       new.status, new.attempts, new.payload_sha256, new.last_error_code);
  end if;
  return new;
end;
$$;

-- Complete all owner-only ACL/comment changes before transferring ownership.
revoke all on function public.record_async_mirror_inbox_event() from public;

comment on function public.record_async_mirror_inbox_event() is
  'SECURITY DEFINER trigger owned by a NOLOGIN role limited to appending payload-free inbox events; fixed search_path and fully qualified target.';

-- Ownership transfer is the final function-level operation: after this point
-- the migration login must no longer act as the function owner.
alter function public.record_async_mirror_inbox_event() owner to rupaykg_inbox_event_writer;
revoke create on schema public from rupaykg_inbox_event_writer;
revoke rupaykg_inbox_event_writer from current_user;

-- Some managed PostgreSQL providers retain a provider-owned, non-inheriting
-- membership row for the database owner. Fail closed if the migration login
-- can still SET ROLE or inherit the capability after its temporary grant is revoked.
do $$
declare migration_login_is_superuser boolean;
begin
  select rolsuper into migration_login_is_superuser
    from pg_roles where rolname=current_user;

  -- PostgreSQL superusers can SET ROLE to any role by definition; the
  -- production migration login must instead be unable to SET or inherit it.
  if not coalesce(migration_login_is_superuser, false)
     and (
       pg_has_role(current_user, 'rupaykg_inbox_event_writer', 'SET')
       or pg_has_role(current_user, 'rupaykg_inbox_event_writer', 'USAGE')
     ) then
    raise exception 'INBOX_EVENT_WRITER_MUST_NOT_BE_SET_OR_INHERITED_BY_MIGRATION_LOGIN';
  end if;
end
$$;
