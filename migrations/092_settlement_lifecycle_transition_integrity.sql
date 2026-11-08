-- Shakti settlement lifecycle integrity.
-- Database state transitions must follow the authoritative lifecycle even when
-- a caller bypasses the application route layer.

create or replace function enforce_settlement_lifecycle_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if not (
    (old.status = 'CREATED' and new.status = 'AUTHORIZED')
    or (old.status = 'AUTHORIZED' and new.status = 'EXECUTING')
    or (old.status = 'EXECUTING' and new.status = 'RECONCILING')
    or (old.status = 'RECONCILING' and new.status = 'SETTLED')
    or (old.status in ('CREATED','AUTHORIZED','EXECUTING','RECONCILING') and new.status = 'CANCELLED')
  ) then
    raise exception 'invalid settlement lifecycle transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists settlement_lifecycle_transition_guard on settlements;
create trigger settlement_lifecycle_transition_guard
before update of status on settlements
for each row execute function enforce_settlement_lifecycle_transition();
