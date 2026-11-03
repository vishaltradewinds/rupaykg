-- Reviewed field-device-to-facility association.
-- This binds an enrolled capture device to an operating site; it is not sensor calibration,
-- instrument qualification, MeitY approval, custody proof, or methodology approval.
create table facility_device_links (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references organizations(id),
 facility_id uuid not null references facilities(id),
 device_id uuid not null references field_devices(id),
 status text not null default 'PENDING' check(status in ('PENDING','VERIFIED','REJECTED')),
 note text not null check(length(trim(note)) between 5 and 2000),
 created_by_identity_id uuid not null references identities(id),
 reviewed_by_identity_id uuid references identities(id),
 review_note text,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 check ((status='PENDING' and reviewed_by_identity_id is null and reviewed_at is null and review_note is null)
    or (status in ('VERIFIED','REJECTED') and reviewed_by_identity_id is not null and reviewed_at is not null and review_note is not null)),
 check (status='PENDING' or reviewed_by_identity_id is distinct from created_by_identity_id)
);
create unique index facility_device_one_open_link_per_pair on facility_device_links(facility_id,device_id) where status in ('PENDING','VERIFIED');
create index facility_device_links_facility_idx on facility_device_links(facility_id,status,created_at desc);
create index facility_device_links_device_idx on facility_device_links(device_id,status,created_at desc);
create index facility_device_links_org_idx on facility_device_links(organization_id,status,created_at desc);
create table facility_device_link_events (
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references facility_device_links(id),
 actor_identity_id uuid not null references identities(id),
 event_type text not null check(event_type in ('LINK_REQUESTED','LINK_REVIEWED')),
 previous_status text,
 new_status text not null check(new_status in ('PENDING','VERIFIED','REJECTED')),
 note text not null,
 payload jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index facility_device_link_events_idx on facility_device_link_events(link_id,created_at);
create or replace function enforce_facility_device_link_scope()
returns trigger language plpgsql as $$
declare f_org uuid; f_geo uuid; f_status text; d_org uuid; d_status text;
begin
 select organization_id,geography_id,operational_status into f_org,f_geo,f_status from facilities where id=new.facility_id for share;
 select organization_id,status into d_org,d_status from field_devices where id=new.device_id for share;
 if f_org is null or d_org is null or new.organization_id is distinct from f_org or new.organization_id is distinct from d_org then
  raise exception 'facility device link must stay within one organization';
 end if;
 if not organization_has_geography_scope(new.organization_id,f_geo) then
  raise exception 'facility device link geography is outside organization authorization scope';
 end if;
 if d_status <> 'VERIFIED' then
  raise exception 'facility device link requires an independently verified enrolled device';
 end if;
 if (tg_op='INSERT' or new.status='VERIFIED') and f_status<>'ACTIVE' then
  raise exception 'facility device link requires an independently activated facility profile';
 end if;
 if tg_op='UPDATE' then
  if new.organization_id<>old.organization_id or new.facility_id<>old.facility_id or new.device_id<>old.device_id or new.created_by_identity_id<>old.created_by_identity_id or new.note<>old.note then
   raise exception 'facility device link identity fields are immutable';
  end if;
  if old.status<>'PENDING' or new.status not in ('VERIFIED','REJECTED') then
   raise exception 'facility device link can only transition once from PENDING to a reviewed terminal state';
  end if;
 end if;
 if new.status in ('VERIFIED','REJECTED') then
  if new.reviewed_by_identity_id is null or new.reviewed_at is null or new.review_note is null then
   raise exception 'facility device link review metadata is required';
  end if;
  if new.reviewed_by_identity_id=new.created_by_identity_id then
   raise exception 'facility device link requester cannot review their own link';
  end if;
  if not exists(select 1 from organization_memberships om where om.organization_id=new.organization_id and om.identity_id=new.reviewed_by_identity_id and om.status='VERIFIED') then
   raise exception 'facility device link reviewer must be a verified organization member';
  end if;
 elsif new.reviewed_by_identity_id is not null or new.reviewed_at is not null or new.review_note is not null then
  raise exception 'pending facility device link cannot carry review metadata';
 end if;
 return new;
end; $$;
create trigger facility_device_link_scope_guard before insert or update on facility_device_links for each row execute function enforce_facility_device_link_scope();
create or replace function prevent_facility_geography_change_with_open_activity_links()
returns trigger language plpgsql as $$
begin
 if new.geography_id is distinct from old.geography_id then
  if exists(select 1 from facility_activity_links where facility_id=old.id and status in ('PENDING','VERIFIED')) then
   raise exception 'cannot change facility geography while pending or verified activity links exist';
  end if;
  if exists(select 1 from resource_flows where source_facility_id=old.id or destination_facility_id=old.id) then
   raise exception 'cannot change facility geography while resource flows reference this facility';
  end if;
  if exists(select 1 from facility_device_links where facility_id=old.id and status in ('PENDING','VERIFIED')) then
   raise exception 'cannot change facility geography while pending or verified device links exist';
  end if;
 end if;
 return new;
end; $$;
create or replace function prevent_facility_device_link_event_mutation()
returns trigger language plpgsql as $$
begin raise exception 'facility device link events are append-only'; end; $$;
create trigger facility_device_link_events_append_only before update or delete on facility_device_link_events for each row execute function prevent_facility_device_link_event_mutation();
