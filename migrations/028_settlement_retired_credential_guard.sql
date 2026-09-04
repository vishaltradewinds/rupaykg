-- Retired registry credentials are no longer settleable.
-- Keep this invariant at the authoritative PostgreSQL boundary so direct SQL,
-- future APIs, and current HTTP routes cannot create settlements against retired value.

create or replace function prevent_settlement_for_retired_credential()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from credentials c
    where c.id = new.credential_id
      and c.status = 'RETIRED'
  ) then
    raise exception 'Retired credentials cannot create settlements'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists settlements_reject_retired_credential on settlements;
create trigger settlements_reject_retired_credential
before insert on settlements
for each row
execute function prevent_settlement_for_retired_credential();

-- Also prevent an already-created settlement from being silently attached to
-- a credential that is subsequently retired by blocking credential retirement
-- while any non-terminal settlement remains open.
create or replace function prevent_credential_retirement_with_open_settlement()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'RETIRED' and old.status <> 'RETIRED' and exists (
    select 1
    from settlements s
    where s.credential_id = new.id
      and s.status not in ('SETTLED', 'CANCELLED')
  ) then
    raise exception 'Credential cannot be retired while a settlement is open'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists credentials_reject_retirement_with_open_settlement on credentials;
create trigger credentials_reject_retirement_with_open_settlement
before update of status on credentials
for each row
execute function prevent_credential_retirement_with_open_settlement();
