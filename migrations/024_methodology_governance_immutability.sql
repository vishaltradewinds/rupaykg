-- Methodology governance evidence becomes authoritative once mapped.
-- A production methodology must never silently regress or have its locked
-- regulatory source/equation basis rewritten in place.

create or replace function enforce_methodology_governance_immutability()
returns trigger language plpgsql as $$
declare
  old_rank integer;
  new_rank integer;
begin
  old_rank := case old.governance_status
    when 'SOURCE_LOCKED' then 1
    when 'IMPLEMENTATION_MAPPED' then 2
    when 'NUMERICALLY_RECONCILED' then 3
    when 'REGRESSION_VERIFIED' then 4
    when 'PRODUCTION_ELIGIBLE' then 5
    else 0
  end;
  new_rank := case new.governance_status
    when 'SOURCE_LOCKED' then 1
    when 'IMPLEMENTATION_MAPPED' then 2
    when 'NUMERICALLY_RECONCILED' then 3
    when 'REGRESSION_VERIFIED' then 4
    when 'PRODUCTION_ELIGIBLE' then 5
    else 0
  end;

  if new_rank < old_rank then
    raise exception 'methodology governance status cannot regress from % to %', old.governance_status, new.governance_status;
  end if;

  if old_rank >= 2 then
    if new.source_reference is distinct from old.source_reference
       or new.source_hash is distinct from old.source_hash
       or new.applicability_rules is distinct from old.applicability_rules
       or new.parameter_dictionary is distinct from old.parameter_dictionary
       or new.equation_mapping is distinct from old.equation_mapping then
      raise exception 'locked methodology source and implementation mapping cannot be changed after implementation mapping';
    end if;
  end if;

  if old_rank >= 3 then
    if new.reconciliation_reference is distinct from old.reconciliation_reference
       or new.reconciled_at is distinct from old.reconciled_at
       or new.reconciliation_evidence is distinct from old.reconciliation_evidence then
      raise exception 'methodology numerical reconciliation evidence cannot be changed after reconciliation';
    end if;
  end if;

  if old_rank >= 4 and new.regression_verified_at is distinct from old.regression_verified_at then
    raise exception 'methodology regression verification evidence cannot be changed after verification';
  end if;

  return new;
end;
$$;

drop trigger if exists methodology_governance_immutability_guard on methodology_versions;
create trigger methodology_governance_immutability_guard
before update on methodology_versions
for each row execute function enforce_methodology_governance_immutability();
