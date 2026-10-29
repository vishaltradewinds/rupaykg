-- Freeze EPR source-binding provenance after eligibility/rejection and prevent
-- any binding deletion. The allocation ledger is only trustworthy if its source
-- measurement, mapping and verifier references cannot be rewritten afterwards.
create or replace function guard_epr_quantity_source_binding_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'EPR quantity source bindings are retained as audit records and cannot be deleted';
  end if;

  if old.binding_status in ('ELIGIBLE', 'REJECTED')
     or exists (
       select 1 from epr_quantity_allocation_events a
       where a.binding_id = old.id
     ) then
    raise exception 'EPR source binding is frozen after eligibility, rejection, or allocation; create a new binding/version';
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.scheme_id is distinct from old.scheme_id
     or new.category_code is distinct from old.category_code
     or new.obligation_id is distinct from old.obligation_id
     or new.mapping_version_id is distinct from old.mapping_version_id
     or new.resource_flow_id is distinct from old.resource_flow_id
     or new.mrv_observation_id is distinct from old.mrv_observation_id
     or new.evidence_id is distinct from old.evidence_id
     or new.verification_id is distinct from old.verification_id
     or new.source_quantity is distinct from old.source_quantity
     or new.source_unit is distinct from old.source_unit
     or new.eligible_quantity is distinct from old.eligible_quantity
     or new.target_unit is distinct from old.target_unit
     or new.observed_at is distinct from old.observed_at then
    raise exception 'EPR source-binding provenance is immutable; create a new binding';
  end if;

  if old.binding_status = 'PENDING'
     and new.binding_status not in ('PENDING', 'ELIGIBLE', 'REJECTED') then
    raise exception 'Invalid EPR source-binding state transition';
  end if;
  if new.binding_status = 'REJECTED'
     and (new.rejection_reason is null or length(trim(new.rejection_reason)) = 0) then
    raise exception 'Rejected EPR source binding requires a reason';
  end if;
  if new.binding_status = 'ELIGIBLE' and new.rejection_reason is not null then
    raise exception 'Eligible EPR source binding cannot have a rejection reason';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_quantity_source_binding_mutation_guard on epr_quantity_source_bindings;
create trigger epr_quantity_source_binding_mutation_guard
before update or delete on epr_quantity_source_bindings
for each row execute function guard_epr_quantity_source_binding_mutation();
