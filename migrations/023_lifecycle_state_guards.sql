-- Database-level lifecycle guards for value-bearing registry and settlement state.
-- Route authorization remains responsible for actor permissions; these triggers prevent
-- direct or accidental state rewrites that bypass the domain state machine.

create or replace function enforce_credential_lifecycle()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('ELIGIBLE','ISSUED') then
      raise exception 'credential may only be created in ELIGIBLE or ISSUED state';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'ELIGIBLE' and new.status = 'ISSUED') or
    (old.status = 'ISSUED' and new.status = 'ACTIVE') or
    (old.status = 'ACTIVE' and new.status in ('TRANSFERRED','RETIRED')) or
    (old.status = 'TRANSFERRED' and new.status = 'RETIRED')
  ) then
    raise exception 'invalid credential lifecycle transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists credential_lifecycle_guard on credentials;
create trigger credential_lifecycle_guard
before insert or update on credentials
for each row execute function enforce_credential_lifecycle();

create or replace function enforce_settlement_lifecycle()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('ELIGIBLE','CREATED') then
      raise exception 'settlement may only be created in ELIGIBLE or CREATED state';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'ELIGIBLE' and new.status = 'CREATED') or
    (old.status = 'CREATED' and new.status = 'AUTHORIZED') or
    (old.status = 'AUTHORIZED' and new.status = 'EXECUTING') or
    (old.status = 'EXECUTING' and new.status = 'RECONCILING') or
    (old.status = 'RECONCILING' and new.status = 'SETTLED') or
    (old.status in ('CREATED','AUTHORIZED','EXECUTING','RECONCILING') and new.status = 'CANCELLED') or
    (old.status in ('CREATED','AUTHORIZED','EXECUTING','RECONCILING') and new.status = 'FAILED')
  ) then
    raise exception 'invalid settlement lifecycle transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists settlement_lifecycle_guard on settlements;
create trigger settlement_lifecycle_guard
before insert or update on settlements
for each row execute function enforce_settlement_lifecycle();
