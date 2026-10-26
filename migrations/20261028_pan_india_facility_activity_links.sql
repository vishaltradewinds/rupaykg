-- Explicit reviewed facility-to-activity linkage. Ambiguous legacy activities remain unassigned.
create table facility_activity_links (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references organizations(id),
 facility_id uuid not null references facilities(id),
 activity_id uuid not null references activities(id),
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
create unique index facility_activity_one_open_link_per_activity on facility_activity_links(activity_id) where status in ('PENDING','VERIFIED');
create index facility_activity_links_facility_idx on facility_activity_links(facility_id,status,created_at);
create index facility_activity_links_org_idx on facility_activity_links(organization_id,status,created_at);
create table facility_activity_link_events (
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references facility_activity_links(id),
 actor_identity_id uuid not null references identities(id),
 event_type text not null check(event_type in ('LINK_REQUESTED','LINK_REVIEWED')),
 previous_status text,
 new_status text not null check(new_status in ('PENDING','VERIFIED','REJECTED')),
 note text not null,
 payload jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index facility_activity_link_events_idx on facility_activity_link_events(link_id,created_at);
create or replace function enforce_facility_activity_link_scope() returns trigger language plpgsql as $$
declare f_org uuid; f_geo uuid; f_status text; a_org uuid; a_geo uuid;
begin
 select organization_id,geography_id,operational_status into f_org,f_geo,f_status from facilities where id=new.facility_id for share;
 select organization_id,geography_id into a_org,a_geo from activities where id=new.activity_id for share;
 if f_org is null or a_org is null or new.organization_id<>f_org or new.organization_id<>a_org then
  raise exception 'facility activity link must stay within one organization';
 end if;
 if f_geo is null or a_geo is null or f_geo<>a_geo then
  raise exception 'facility activity link requires exact matching facility and activity geography';
 end if;
 if not organization_has_geography_scope(new.organization_id,f_geo) or not organization_has_geography_scope(new.organization_id,a_geo) then
  raise exception 'facility activity link geography is outside organization authorization scope';
 end if;
 if (tg_op='INSERT' or new.status='VERIFIED') and f_status<>'ACTIVE' then
  raise exception 'facility activity link requires an independently activated facility profile';
 end if;
 if tg_op='UPDATE' then
  if new.organization_id<>old.organization_id or new.facility_id<>old.facility_id or new.activity_id<>old.activity_id or new.created_by_identity_id<>old.created_by_identity_id or new.note<>old.note then
   raise exception 'facility activity link identity fields are immutable';
  end if;
  if old.status<>'PENDING' or new.status not in ('VERIFIED','REJECTED') then
   raise exception 'facility activity link can only transition once from PENDING to a reviewed terminal state';
  end if;
 end if;
 if new.status in ('VERIFIED','REJECTED') then
  if new.reviewed_by_identity_id is null or new.reviewed_at is null or new.review_note is null then
   raise exception 'facility activity link review metadata is required';
  end if;
  if new.reviewed_by_identity_id=new.created_by_identity_id then
   raise exception 'facility activity link requester cannot review their own link';
  end if;
  if not exists(select 1 from organization_memberships om where om.organization_id=new.organization_id and om.identity_id=new.reviewed_by_identity_id and om.status='VERIFIED') then
   raise exception 'facility activity link reviewer must be a verified organization member';
  end if;
 elsif new.reviewed_by_identity_id is not null or new.reviewed_at is not null or new.review_note is not null then
  raise exception 'pending facility activity link cannot carry review metadata';
 end if;
 return new;
end; $$;
create trigger facility_activity_link_scope_guard before insert or update on facility_activity_links for each row execute function enforce_facility_activity_link_scope();
create or replace function prevent_facility_geography_change_with_open_activity_links() returns trigger language plpgsql as $$$
begin
 if new.geography_id is distinct from old.geography_id and exists(
   select 1 from facility_activity_links where facility_id=old.id and status in ('PENDING','VERIFIED')
 ) then
  raise exception 'cannot change facility geography while pending or verified activity links exist';
 end if;
 return new;
end; $$;
create trigger facilities_activity_link_geography_guard
before update of geography_id on facilities
for each row execute function prevent_facility_geography_change_with_open_activity_links();

create or replace function prevent_facility_activity_link_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'facility activity link events are append-only'; end; $$;
create trigger facility_activity_link_events_append_only before update or delete on facility_activity_link_events for each row execute function prevent_facility_activity_link_event_mutation();
