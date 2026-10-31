-- Serialize crosswalk approval/revocation/replacement with worker resolution for the same
-- authority + municipality + source-version key. The worker acquires this transaction
-- advisory lock before reading candidates and holds it through the fenced inbox transition.
-- This closes the concurrent INSERT/phantom gap that row locks alone cannot close.

create or replace function public.lock_government_crosswalk_resolution_key()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  old_key text;
  new_key text;
begin
  new_key := new.authority_code || chr(31) || new.municipal_code || chr(31) || new.source_version;

  if TG_OP = 'UPDATE' then
    old_key := old.authority_code || chr(31) || old.municipal_code || chr(31) || old.source_version;
    if old_key = new_key then
      perform pg_advisory_xact_lock(hashtextextended(new_key, 0));
    elsif old_key < new_key then
      perform pg_advisory_xact_lock(hashtextextended(old_key, 0));
      perform pg_advisory_xact_lock(hashtextextended(new_key, 0));
    else
      perform pg_advisory_xact_lock(hashtextextended(new_key, 0));
      perform pg_advisory_xact_lock(hashtextextended(old_key, 0));
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(new_key, 0));
  end if;

  return new;
end;
$$;

drop trigger if exists government_crosswalk_resolution_key_lock on public.government_jurisdiction_crosswalks;
create trigger government_crosswalk_resolution_key_lock
before insert or update on public.government_jurisdiction_crosswalks
for each row execute function public.lock_government_crosswalk_resolution_key();

revoke all on function public.lock_government_crosswalk_resolution_key() from public;

comment on function public.lock_government_crosswalk_resolution_key() is
  'Transaction-scoped per-authority/municipality/source-version lock shared with the inbox worker; serializes crosswalk insert, approval, revocation and key replacement against resolution.';
