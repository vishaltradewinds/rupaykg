-- Pan-India facility registry. A facility is a distinct operating location, not an organization or geography.
-- This migration is additive. It does not backfill ambiguous legacy activities or imply regulatory approval.

create table facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  facility_code text not null,
  name text not null,
  facility_type text not null check (facility_type in (
    'BULK_WASTE_GENERATOR','COLLECTION_CENTRE','AGGREGATION_CENTRE',
    'TRANSFER_STATION','MATERIAL_RECOVERY_FACILITY','RECYCLING_PROCESSING',
    'TREATMENT_FACILITY','DISPOSAL_FACILITY','COMPOSTING_BIOGAS',
    'WASTE_TO_ENERGY','WAREHOUSE','OTHER'
  )),
  operational_status text not null default 'UNVERIFIED' check (operational_status in (
    'UNVERIFIED','ACTIVE','INACTIVE','SUSPENDED','CLOSED'
  )),
  geography_id uuid not null references geography(id),
  address jsonb not null default '{}',
  process_profile jsonb not null default '{}',
  metadata jsonb not null default '{}',
  version integer not null default 1 check (version > 0),
  created_by_identity_id uuid not null references identities(id),
  updated_by_identity_id uuid not null references identities(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, facility_code)
);

create index facilities_org_status_idx on facilities(organization_id, operational_status);
create index facilities_geography_idx on facilities(geography_id);
create index facilities_org_geo_idx on facilities(organization_id, geography_id);

create table facility_memberships (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  identity_id uuid not null references identities(id),
  membership_role text not null check (membership_role in ('MANAGER','OPERATOR','VIEWER','FACILITY_REVIEWER')),
  status record_status not null default 'PENDING',
  assigned_by_identity_id uuid not null references identities(id),
  reviewed_by_identity_id uuid references identities(id),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (facility_id, identity_id, membership_role),
  check ((status = 'VERIFIED' and reviewed_by_identity_id is not null and reviewed_at is not null)
      or status <> 'VERIFIED')
);

create index facility_memberships_identity_idx on facility_memberships(identity_id, status);
create index facility_memberships_facility_idx on facility_memberships(facility_id, status);

create table facility_review_events (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  actor_identity_id uuid not null references identities(id),
  event_type text not null check (event_type in ('PROFILE_CREATED','PROFILE_UPDATED','STATUS_REVIEWED','MEMBERSHIP_GRANTED','MEMBERSHIP_REVIEWED')),
  previous_version integer,
  new_version integer,
  previous_status text,
  new_status text,
  note text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index facility_review_events_facility_idx on facility_review_events(facility_id, created_at);

create or replace function enforce_facility_geography_scope()
returns trigger language plpgsql as $$
begin
  if not organization_has_geography_scope(new.organization_id, new.geography_id) then
    raise exception 'facility geography is outside organization authorization scope';
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger facilities_geography_scope_guard
before insert or update on facilities
for each row execute function enforce_facility_geography_scope();

create or replace function enforce_facility_membership_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from facilities f
    join organization_memberships om on om.organization_id=f.organization_id
    where f.id=new.facility_id
      and om.identity_id=new.identity_id
      and om.status='VERIFIED'
  ) then
    raise exception 'facility membership identity must have verified membership in the facility organization';
  end if;
  if new.reviewed_by_identity_id is not null and not exists (
    select 1 from facilities f
    join organization_memberships om on om.organization_id=f.organization_id
    where f.id=new.facility_id
      and om.identity_id=new.reviewed_by_identity_id
      and om.status='VERIFIED'
  ) then
    raise exception 'facility membership reviewer must have verified membership in the facility organization';
  end if;
  if new.status='VERIFIED' and new.reviewed_by_identity_id=new.assigned_by_identity_id then
    raise exception 'facility membership grantor cannot review their own grant';
  end if;
  return new;
end;
$$;

create trigger facility_membership_tenant_guard
before insert or update on facility_memberships
for each row execute function enforce_facility_membership_tenant();

create or replace function prevent_facility_review_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'facility review events are append-only';
end;
$$;

create trigger facility_review_events_append_only
before update or delete on facility_review_events
for each row execute function prevent_facility_review_event_mutation();
