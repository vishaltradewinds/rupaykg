-- Database-owned provenance for facility-device association lifecycle.
-- Link transitions always emit an immutable event even if a future API path omits app-level logging.
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
 if tg_op='INSERT' and not exists(select 1 from organization_memberships om where om.organization_id=new.organization_id and om.identity_id=new.created_by_identity_id and om.status='VERIFIED') then
  raise exception 'facility device link requester must be a verified organization member';
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

create or replace function record_facility_device_link_event()
returns trigger language plpgsql as $$
begin
 if tg_op='INSERT' then
  insert into facility_device_link_events(link_id,actor_identity_id,event_type,previous_status,new_status,note,payload)
  values(new.id,new.created_by_identity_id,'LINK_REQUESTED',null,new.status,new.note,
    jsonb_build_object('organizationId',new.organization_id,'facilityId',new.facility_id,'deviceId',new.device_id));
 else
  insert into facility_device_link_events(link_id,actor_identity_id,event_type,previous_status,new_status,note,payload)
  values(new.id,new.reviewed_by_identity_id,'LINK_REVIEWED',old.status,new.status,new.review_note,
    jsonb_build_object('reviewedAt',new.reviewed_at,'decision',new.status));
 end if;
 return new;
end; $$;
drop trigger if exists facility_device_link_event_recorder on facility_device_links;
create trigger facility_device_link_event_recorder after insert or update of status on facility_device_links
for each row execute function record_facility_device_link_event();
