-- EPR authoritative quantity-binding foundation.
-- Deliberately creates an empty approval catalogue: no statutory mappings are invented.
-- Existing obligations without an explicit category remain ineligible for allocation.
alter table epr_obligations
  add column if not exists category_code text;

create table epr_quantity_mapping_versions (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references epr_schemes(id),
  category_code text not null check (length(trim(category_code)) > 0),
  source_unit text not null check (length(trim(source_unit)) > 0),
  target_unit text not null check (length(trim(target_unit)) > 0),
  conversion_factor numeric(30,12) not null check (conversion_factor > 0),
  source_reference text not null check (length(trim(source_reference)) > 0),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  effective_from date not null,
  effective_to date,
  approval_status text not null default 'DRAFT'
    check (approval_status in ('DRAFT','APPROVED','RETIRED')),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (
    (approval_status = 'APPROVED' and approved_by is not null and length(trim(approved_by)) > 0 and approved_at is not null)
    or approval_status <> 'APPROVED'
  )
);

create index epr_quantity_mapping_lookup_idx
  on epr_quantity_mapping_versions(scheme_id, category_code, approval_status, effective_from, effective_to);

create table epr_quantity_source_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  scheme_id uuid not null references epr_schemes(id),
  category_code text not null check (length(trim(category_code)) > 0),
  obligation_id uuid not null references epr_obligations(id),
  mapping_version_id uuid not null references epr_quantity_mapping_versions(id),
  resource_flow_id uuid not null references resource_flows(id),
  mrv_observation_id uuid not null references mrv_observations(id),
  evidence_id uuid not null references evidence(id),
  verification_id uuid not null references verifications(id),
  source_quantity numeric(30,12) not null check (source_quantity > 0),
  source_unit text not null check (length(trim(source_unit)) > 0),
  eligible_quantity numeric(30,12) not null check (eligible_quantity > 0),
  target_unit text not null check (length(trim(target_unit)) > 0),
  observed_at timestamptz not null,
  binding_status text not null default 'PENDING'
    check (binding_status in ('PENDING','ELIGIBLE','REJECTED')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique(mrv_observation_id),
  check ((binding_status = 'REJECTED' and rejection_reason is not null) or binding_status <> 'REJECTED')
);

create index epr_quantity_binding_obligation_idx
  on epr_quantity_source_bindings(obligation_id, binding_status);
create index epr_quantity_binding_flow_idx
  on epr_quantity_source_bindings(resource_flow_id);

create table epr_quantity_allocation_events (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references epr_quantity_source_bindings(id),
  obligation_id uuid not null references epr_obligations(id),
  action text not null check (action in ('ALLOCATE','REVERSE')),
  quantity numeric(30,12) not null check (quantity > 0),
  reverses_event_id uuid references epr_quantity_allocation_events(id),
  idempotency_key text not null unique check (length(trim(idempotency_key)) > 0),
  actor_id text not null check (length(trim(actor_id)) > 0),
  reason text,
  created_at timestamptz not null default now(),
  check (
    (action = 'ALLOCATE' and reverses_event_id is null)
    or (action = 'REVERSE' and reverses_event_id is not null and reason is not null and length(trim(reason)) > 0)
  )
);

create index epr_quantity_allocation_binding_idx
  on epr_quantity_allocation_events(binding_id, created_at);
create index epr_quantity_allocation_obligation_idx
  on epr_quantity_allocation_events(obligation_id, created_at);

create or replace function prevent_epr_quantity_mapping_mutation()
returns trigger language plpgsql as $$
begin
  if old.approval_status in ('APPROVED','RETIRED') then
    raise exception 'approved or retired EPR quantity mappings are immutable; create a new version';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'EPR quantity mapping versions cannot be deleted';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_quantity_mapping_immutability_guard on epr_quantity_mapping_versions;
create trigger epr_quantity_mapping_immutability_guard
before update or delete on epr_quantity_mapping_versions
for each row execute function prevent_epr_quantity_mapping_mutation();

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
  allocated numeric(30,12);
begin
  select * into mapping from epr_quantity_mapping_versions
    where id = new.mapping_version_id for share;
  if not found or mapping.approval_status <> 'APPROVED' then
    raise exception 'EPR quantity binding requires an approved versioned mapping';
  end if;

  select * into obligation from epr_obligations
    where id = new.obligation_id for share;
  if not found
     or obligation.obligated_organization_id <> new.organization_id
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
  select * into observation from mrv_observations where id = new.mrv_observation_id;
  select * into evidence_row from evidence where id = new.evidence_id;
  select * into verification_row from verifications where id = new.verification_id;

  if not found then
    raise exception 'EPR quantity binding source records are incomplete';
  end if;
  select a.organization_id into activity_org
    from activities a where a.id = observation.activity_id;
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

  select coalesce(sum(
    case when action = 'ALLOCATE' then quantity else -quantity end
  ), 0) into allocated
  from epr_quantity_allocation_events where binding_id = new.id;

  if new.binding_status = 'ELIGIBLE' and new.rejection_reason is not null then
    raise exception 'eligible EPR quantity binding cannot have a rejection reason';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_quantity_binding_validation_guard on epr_quantity_source_bindings;
create trigger epr_quantity_binding_validation_guard
before insert or update on epr_quantity_source_bindings
for each row execute function validate_epr_quantity_source_binding();

create or replace function validate_epr_quantity_allocation_event()
returns trigger language plpgsql as $$
declare
  binding epr_quantity_source_bindings%rowtype;
  obligation epr_obligations%rowtype;
  original epr_quantity_allocation_events%rowtype;
  already_allocated numeric(30,12);
  already_reversed numeric(30,12);
  obligation_allocated numeric(30,12);
begin
  select * into binding from epr_quantity_source_bindings
    where id = new.binding_id for update;
  if not found or binding.binding_status <> 'ELIGIBLE' then
    raise exception 'EPR allocation requires an eligible source binding';
  end if;
  if binding.obligation_id <> new.obligation_id then
    raise exception 'EPR allocation obligation does not match the source binding';
  end if;

  select * into obligation from epr_obligations
    where id = new.obligation_id for update;
  if not found
     or obligation.obligated_organization_id <> binding.organization_id
     or obligation.scheme_id <> binding.scheme_id
     or obligation.category_code is null
     or obligation.category_code <> binding.category_code then
    raise exception 'EPR allocation requires a matching categorized obligation';
  end if;

  if new.action = 'ALLOCATE' then
    select coalesce(sum(case when action='ALLOCATE' then quantity else -quantity end),0)
      into already_allocated
    from epr_quantity_allocation_events where binding_id = new.binding_id;
    if already_allocated + new.quantity > binding.eligible_quantity then
      raise exception 'EPR allocations exceed eligible source quantity';
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
       or original.obligation_id <> new.obligation_id then
      raise exception 'EPR reversal must reference an allocation for the same binding and obligation';
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

create trigger epr_quantity_allocation_validation_guard
before insert on epr_quantity_allocation_events
for each row execute function validate_epr_quantity_allocation_event();

create or replace function prevent_epr_quantity_allocation_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'EPR quantity allocation events are append-only; add a reversal event instead';
end;
$$;

create trigger epr_quantity_allocation_immutability_guard
before update or delete on epr_quantity_allocation_events
for each row execute function prevent_epr_quantity_allocation_mutation();
