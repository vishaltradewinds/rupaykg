-- Authoritative EPR quantity binding: no client quantity is treated as fulfillment.
-- A measurement/custody pair can be consumed by at most one EPR return.
create table epr_return_quantity_bindings (
  id uuid primary key default gen_random_uuid(),
  epr_return_id uuid not null unique references epr_returns(id),
  obligation_id uuid not null references epr_obligations(id),
  measurement_id uuid not null unique references measurements(id),
  resource_flow_id uuid not null references resource_flows(id),
  custody_link_id uuid not null unique references chain_of_custody_links(id),
  evidence_id uuid not null references evidence(id),
  verification_id uuid not null references verifications(id),
  methodology_version_id uuid not null references methodology_versions(id),
  category_code text not null,
  unit_code text not null,
  period_start date not null,
  period_end date not null,
  measured_quantity numeric(20,6) not null check (measured_quantity > 0),
  created_by_identity_id uuid not null references identities(id),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_start <= period_end)
);

create index epr_quantity_binding_obligation_idx
  on epr_return_quantity_bindings(obligation_id, period_start, period_end);

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
     or old.created_by_identity_id is distinct from new.created_by_identity_id then
    raise exception 'EPR quantity binding provenance is immutable';
  end if;
  if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then
    raise exception 'EPR quantity binding consumption is immutable';
  end if;
  return new;
end;
$$;

create trigger epr_quantity_binding_immutability_guard
before update on epr_return_quantity_bindings
for each row execute function prevent_epr_quantity_binding_mutation();
