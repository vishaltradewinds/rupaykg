-- Preserve the original user-declared return quantity when binding to authoritative measurement.
alter table epr_return_quantity_bindings
  add column if not exists declared_quantity_before_binding numeric(20,6);

update epr_return_quantity_bindings b
   set declared_quantity_before_binding = r.reported_quantity
  from epr_returns r
 where r.id = b.epr_return_id
   and b.declared_quantity_before_binding is null;

alter table epr_return_quantity_bindings
  alter column declared_quantity_before_binding set not null;


create or replace function prevent_epr_quantity_binding_mutation()
returns trigger language plpgsql as $$
begin
  if old.epr_return_id is distinct from new.epr_return_id
     or old.obligation_id is distinct from new.obligation_id
     or old.measurement_id is distinct from new.measurement_id
     or old.resource_flow_id is distinct from new.resource_flow_id
     or old.custody_link_id is distinct from new.custody_link_id
     or old.evidence_id is distinct from new.evidence_id
     or old.verification_id is distinct from new.verification_id
     or old.methodology_version_id is distinct from new.methodology_version_id
     or old.category_code is distinct from new.category_code
     or old.unit_code is distinct from new.unit_code
     or old.period_start is distinct from new.period_start
     or old.period_end is distinct from new.period_end
     or old.measured_quantity is distinct from new.measured_quantity
     or old.created_by_identity_id is distinct from new.created_by_identity_id
     or old.declared_quantity_before_binding is distinct from new.declared_quantity_before_binding then
    raise exception 'EPR quantity binding provenance is immutable';
  end if;
  if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then
    raise exception 'EPR quantity binding consumption is immutable';
  end if;
  return new;
end;
$$;
