-- Settlement execution evidence must exist before an externally-reconcilable state.
-- This closes the gap where direct database writes could reach EXECUTING/RECONCILING
-- without the external authority reference required by the lifecycle.

create or replace function prevent_settlement_execution_without_external_reference()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('EXECUTING','RECONCILING','SETTLED') then
    if new.external_reference is null or btrim(new.external_reference) = '' then
      raise exception 'executing settlement requires external settlement reference';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists settlement_execution_external_reference_guard on settlements;
create trigger settlement_execution_external_reference_guard
before insert or update on settlements
for each row execute function prevent_settlement_execution_without_external_reference();
