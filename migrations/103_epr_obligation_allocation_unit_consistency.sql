-- Forward-only correction: obligation balance is a scalar and must not
-- combine allocations expressed in different target units. A normalized,
-- approved obligation-unit model is still required before broader enablement.
-- Correct dimensional comparison: allocation quantities are in target units,
-- while resource_flows.declared_quantity is in the source unit. Compare the
-- source-equivalent of each allocation using its own approved mapping factor.
-- Leave the unit constraint NOT VALID for legacy rows; it is enforced for new
-- inserts/updates without assuming historical rows are already reconciled.
alter table epr_quantity_allocation_events
  drop constraint if exists epr_quantity_allocation_quantity_unit_required;
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
  flow_allocated_source_equivalent numeric(30,12);
  conversion numeric(30,12);
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

  -- Lock the physical flow row to serialize allocation across all bindings
  -- and obligations consuming the same measured flow.
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

  -- Obligation balances are stored as a single numeric quantity. Until an
  -- authoritative obligation-unit field is modelled and verified, never sum
  -- allocations expressed in different target units into the same balance.
  if exists (
    select 1
    from epr_quantity_allocation_events prior
    where prior.obligation_id = new.obligation_id
      and prior.quantity_unit is distinct from new.quantity_unit
  ) then
    raise exception 'EPR obligation allocations must use one consistent target unit';
  end if;

  select conversion_factor into conversion
  from epr_quantity_mapping_versions
  where id = binding.mapping_version_id
    and approval_status = 'APPROVED'
    and source_unit = binding.source_unit
    and target_unit = binding.target_unit
  for share;
  if not found or conversion is null or conversion <= 0 then
    raise exception 'EPR allocation requires an approved unit conversion';
  end if;

  if new.action = 'ALLOCATE' then
    select coalesce(sum(case when action='ALLOCATE' then quantity else -quantity end),0)
      into already_allocated
    from epr_quantity_allocation_events where binding_id = new.binding_id;
    if already_allocated + new.quantity > binding.eligible_quantity then
      raise exception 'EPR allocations exceed eligible source quantity';
    end if;

    select coalesce(sum(
      case when a.action='ALLOCATE' then a.quantity / m.conversion_factor
           else -a.quantity / m.conversion_factor end
    ),0)
      into flow_allocated_source_equivalent
    from epr_quantity_allocation_events a
    join epr_quantity_source_bindings b on b.id = a.binding_id
    join epr_quantity_mapping_versions m on m.id = b.mapping_version_id
    where b.resource_flow_id = binding.resource_flow_id
      and a.quantity_unit = b.target_unit
      and m.source_unit = flow.unit
      and m.target_unit = a.quantity_unit;
    if flow_allocated_source_equivalent + (new.quantity / conversion) > flow.declared_quantity then
      raise exception 'EPR allocations exceed total resource-flow quantity after unit conversion';
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
