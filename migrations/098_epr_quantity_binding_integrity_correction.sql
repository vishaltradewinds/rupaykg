-- Correct source-row existence checks and freeze eligible EPR bindings.
-- This is a forward-only correction; migration 097 remains unchanged.
create or replace function validate_epr_quantity_source_binding()
returns trigger language plpgsql as $$
declare
  mapping epr_quantity_mapping_versions%rowtype;
  obligation epr_obligations%rowtype;
  flow resource_flows%rowtype;
  observation mrv_observations%rowtype;
  evidence_row evidence%rowtype;
  verification_row verifications%rowtype;
  activity_org uuid;
  custody_ok boolean;
begin
  select * into mapping from epr_quantity_mapping_versions
    where id = new.mapping_version_id for share;
  if not found then
    raise exception 'EPR quantity mapping does not exist';
  end if;
  if mapping.approval_status <> 'APPROVED' then
    raise exception 'EPR quantity binding requires an approved versioned mapping';
  end if;

  select * into obligation from epr_obligations
    where id = new.obligation_id for share;
  if not found then
    raise exception 'EPR obligation does not exist';
  end if;
  if obligation.obligated_organization_id <> new.organization_id
     or obligation.scheme_id <> new.scheme_id
     or obligation.category_code is null
     or obligation.category_code <> new.category_code then
    raise exception 'EPR quantity binding requires a matching categorized obligation';
  end if;

  if mapping.scheme_id <> new.scheme_id or mapping.category_code <> new.category_code
     or mapping.source_unit <> new.source_unit or mapping.target_unit <> new.target_unit
     or new.observed_at::date < mapping.effective_from
     or (mapping.effective_to is not null and new.observed_at::date > mapping.effective_to) then
    raise exception 'EPR quantity binding does not match approved scheme/category/unit/effective-date mapping';
  end if;

  select * into flow from resource_flows where id = new.resource_flow_id;
  if not found then raise exception 'EPR resource flow does not exist'; end if;
  select * into observation from mrv_observations where id = new.mrv_observation_id;
  if not found then raise exception 'EPR MRV observation does not exist'; end if;
  select * into evidence_row from evidence where id = new.evidence_id;
  if not found then raise exception 'EPR source evidence does not exist'; end if;
  select * into verification_row from verifications where id = new.verification_id;
  if not found then raise exception 'EPR source verification does not exist'; end if;

  select a.organization_id into activity_org from activities a where a.id = observation.activity_id;
  if not found then raise exception 'EPR MRV activity does not exist'; end if;

  if flow.organization_id <> new.organization_id
     or activity_org is distinct from new.organization_id
     or observation.unit <> new.source_unit
     or observation.observed_value::numeric(30,12) <> new.source_quantity
     or observation.observed_at <> new.observed_at
     or observation.quality_status::text <> 'VERIFIED'
     or evidence_row.status::text <> 'VERIFIED'
     or (evidence_row.content_hash is null and evidence_row.content_uri is null)
     or verification_row.evidence_id <> new.evidence_id
     or verification_row.decision::text <> 'APPROVED' then
    raise exception 'EPR source measurement, evidence, verification, unit, or organization is not eligible';
  end if;

  select exists (
    select 1 from chain_of_custody_links c
    where c.resource_flow_id = new.resource_flow_id
      and c.activity_id = observation.activity_id
      and c.actor_organization_id = new.organization_id
      and c.evidence_id = new.evidence_id
      and c.unit = new.source_unit
      and c.quantity >= new.source_quantity
  ) into custody_ok;
  if not custody_ok then
    raise exception 'EPR source measurement lacks matching organization-scoped custody evidence';
  end if;

  if abs(new.eligible_quantity - (new.source_quantity * mapping.conversion_factor)) > 0.000001 then
    raise exception 'EPR eligible quantity does not match the approved conversion factor';
  end if;
  if new.binding_status = 'ELIGIBLE' and new.rejection_reason is not null then
    raise exception 'eligible EPR quantity binding cannot have a rejection reason';
  end if;
  return new;
end;
$$;

create or replace function prevent_epr_quantity_source_binding_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'EPR quantity source bindings cannot be deleted; preserve provenance';
  end if;
  if old.binding_status = 'ELIGIBLE'
     or exists (select 1 from epr_quantity_allocation_events a where a.binding_id = old.id) then
    raise exception 'eligible or allocated EPR source bindings are immutable; create a correction/reversal record';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_quantity_binding_immutability_guard on epr_quantity_source_bindings;
create trigger epr_quantity_binding_immutability_guard
before update or delete on epr_quantity_source_bindings
for each row execute function prevent_epr_quantity_source_binding_mutation();
