-- Crosswalk requests and verified mappings must bind to an approved source snapshot manifest.
alter table authoritative_source_snapshots
  add column if not exists authority_code text not null default 'UNSPECIFIED';
alter table authoritative_source_snapshots
  add constraint authoritative_source_snapshots_authority_code_check
  check (authority_code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$');

alter table government_jurisdiction_crosswalk_requests
  add column if not exists source_snapshot_id uuid references authoritative_source_snapshots(id);
alter table government_jurisdiction_crosswalks
  add column if not exists source_snapshot_id uuid references authoritative_source_snapshots(id);

create or replace function enforce_government_crosswalk_snapshot_binding()
returns trigger language plpgsql as $$
declare snapshot record;
begin
  if new.source_snapshot_id is null then
    raise exception 'GOVERNMENT_CROSSWALK_SOURCE_SNAPSHOT_REQUIRED';
  end if;
  select id,authority_code,source_version,validation_status,effective_from,effective_to
    into snapshot from authoritative_source_snapshots where id=new.source_snapshot_id for share;
  if not found
     or snapshot.validation_status <> 'APPROVED'
     or snapshot.authority_code <> new.authority_code
     or snapshot.source_version <> new.source_version
     or (snapshot.effective_from is not null and new.effective_from::date < snapshot.effective_from)
     or (snapshot.effective_to is not null and new.effective_from::date > snapshot.effective_to) then
    raise exception 'GOVERNMENT_CROSSWALK_SOURCE_SNAPSHOT_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists government_crosswalk_request_snapshot_binding on government_jurisdiction_crosswalk_requests;
create trigger government_crosswalk_request_snapshot_binding
before insert or update of authority_code,source_version,source_snapshot_id,effective_from
on government_jurisdiction_crosswalk_requests
for each row execute function enforce_government_crosswalk_snapshot_binding();

drop trigger if exists government_crosswalk_snapshot_binding on government_jurisdiction_crosswalks;
create trigger government_crosswalk_snapshot_binding
before insert or update of authority_code,source_version,source_snapshot_id,effective_from,status
on government_jurisdiction_crosswalks
for each row when (new.status='VERIFIED')
execute function enforce_government_crosswalk_snapshot_binding();

comment on column government_jurisdiction_crosswalk_requests.source_snapshot_id is
  'Approved authoritative source snapshot manifest matching authority_code and source_version; test fixtures may be synthetic only in disposable acceptance environments.';
comment on column government_jurisdiction_crosswalks.source_snapshot_id is
  'Source snapshot that grounds the verified external identifier mapping; missing, stale or mismatched manifests fail closed.';
