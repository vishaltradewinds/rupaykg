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
 check ((status='VERIFIED' and reviewed_by_identity_id is not null and reviewed_at is not null and review_note is not null) or status<>'VERIFIED')
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
declare f_org uuid; f_geo uuid; a_org uuid; a_geo uuid;
begin
 select organization_id,geography_id into f_org,f_geo from facilities where id=new.facility_id;
 select organization_id,geography_id into a_org,a_geo from activities where id=new.activity_id;
 if f_org is null or a_org is null or new.organization_id<>f_org or new.organization_id<>a_org then
  raise exception 'facility activity link must stay within one organization';
 end if;
 if f_geo is null or a_geo is null or f_geo<>a_geo then
  raise exception 'facility activity link requires exact matching facility and activity geography';
 end if;
 if not organization_has_geography_scope(new.organization_id,f_geo) or not organization_has_geography_scope(new.organization_id,a_geo) then
  raise exception 'facility activity link geography is outside organization authorization scope';
 end if;
 if new.status='VERIFIED' and new.reviewed_by_identity_id=new.created_by_identity_id then
  raise exception 'facility activity link requester cannot approve their own link';
 end if;
 return new;
end; $$;
create trigger facility_activity_link_scope_guard before insert or update on facility_activity_links for each row execute function enforce_facility_activity_link_scope();
create or replace function prevent_facility_activity_link_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'facility activity link events are append-only'; end; $$;
create trigger facility_activity_link_events_append_only before update or delete on facility_activity_link_events for each row execute function prevent_facility_activity_link_event_mutation();
