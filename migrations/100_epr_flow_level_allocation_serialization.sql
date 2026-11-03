-- Serialize allocations against the same physical resource flow and unit.
-- This prevents two separately recorded observations of one flow from being
-- independently allocated beyond the flow's declared quantity.
alter table epr_quantity_allocation_events
  add column if not exists quantity_unit text;

-- Existing rows, if any, must be reviewed before this migration is used in a
-- live environment. No approved mappings/allocations should exist on this new
-- foundation; leave unknown historical rows NULL and fail closed for new events.
alter table epr_quantity_allocation_events
  add constraint epr_quantity_allocation_quantity_unit_required
  check (quantity_unit is not null and length(trim(quantity_unit)) > 0) not valid;

create or replace function validate_epr_quantity_allocation_event()
returns trigger language plpgsql as $$
declare
  binding epr_quantity_source_bindings%rowtype;
  obligation epr_obligations%rowtype;
  flow resource_flows%rowtype;
  original epr_quantity_allocation_events%rowtype;
  already_allocated numeric(30,12);
  already_reversed numeric(30,12);
  obligation_allocated numeric(30,12);
  flow_allocated numeric(30,12);
begin
  select * into binding from epr_quantity_source_bindings
    where id = new.binding_id for update;
  if not found or binding.binding_status <> 'ELIGIBLE' then
    raise exception 'EPR allocation requires an eligible source binding';
  end if;
  if binding.obligation_id <> new.obligation_id then
    raise exception 'EPR allocation obligation does not match the source binding';
  end if;
  if new.quantity_unit is distinct from binding.target_unit then
    raise exception 'EPR allocation unit must match the eligible binding target unit';
  end if;

  -- Serialize all allocations that consume the same flow, including attempts
  -- through distinct observations/bindings or distinct obligations.
  select * into flow from resource_flows where id = binding.resource_flow_id for update;
  if not found then raise exception 'EPR allocation resource flow does not exist'; end if;
  if flow.unit is distinct from binding.source_unit then
    raise exception 'EPR source unit does not match resource-flow unit';
  end if;

  select * into obligation from epr_obligations
    where id = new.obligation_id for update;
  if not found
     or obligation.obligated_organization_id is distinct from binding.organization_id
     or obligation.scheme_id is distinct from binding.scheme_id
     or obligation.category_code is null
     or obligation.category_code is distinct from binding.category_code then
    raise exception 'EPR allocation requires a matching categorized obligation';
  end if;

  if new.action = 'ALLOCATE' then
    select coalesce(sum(case when action='ALLOCATE' then quantity else -quantity end),0)
      into already_allocated
    from epr_quantity_allocation_events where binding_id = new.binding_id;
    if already_allocated + new.quantity > binding.eligible_quantity then
      raise exception 'EPR allocations exceed eligible source quantity';
    end if;

    select coalesce(sum(case when a.action='ALLOCATE' then a.quantity else -a.quantity end),0)
      into flow_allocated
    from epr_quantity_allocation_events a
    join epr_quantity_source_bindings b on b.id = a.binding_id
    where b.resource_flow_id = binding.resource_flow_id
      and a.quantity_unit = new.quantity_unit;
    if flow_allocated + new.quantity > flow.declared_quantity then
      raise exception 'EPR allocations exceed total resource-flow quantity for this unit';
    end if;

    select coalesce(sum(case when action='ALLOCATE' then quantity else -quantity end),0)
      into obligation_allocated
    from epr_quantity_allocation_events where obligation_id = new.obligation_id;
    if obligation_allocated + new.quantity > greatest(obligation.target_quantity - obligation.fulfilled_quantity,0) then
      raise exception 'EPR allocations exceed remaining obligation balance';
    end if;
  else
    select * into original from epr_quantity_allocation_events
      where id = new.reverses_event_id for update;
    if not found or original.action <> 'ALLOCATE'
       or original.binding_id <> new.binding_id
       or original.obligation_id <> new.obligation_id
       or original.quantity_unit is distinct from new.quantity_unit then
      raise exception 'EPR reversal must reference an allocation for the same binding, obligation, and unit';
    end if;
    select coalesce(sum(quantity),0) into already_reversed
      from epr_quantity_allocation_events
      where action='REVERSE' and reverses_event_id = original.id;
    if already_reversed + new.quantity > original.quantity then
      raise exception 'EPR reversals exceed original allocation';
    end if;
  end if;
  return new;
end;
$$;

alter table epr_quantity_allocation_events
  validate constraint epr_quantity_allocation_quantity_unit_required;
