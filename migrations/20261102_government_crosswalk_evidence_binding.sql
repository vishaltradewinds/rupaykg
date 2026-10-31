-- Crosswalk evidence must point to immutable evidence-vault bytes; verified mappings require independent review.
create or replace function enforce_government_crosswalk_evidence_binding()
returns trigger language plpgsql as $$
declare
  artifact_found boolean;
begin
  select exists (
    select 1
      from evidence_artifact_versions v
      join evidence_artifact_series s on s.id=v.series_id
     where new.evidence_reference = 'db://evidence-vault/' || v.id::text
       and v.sha256 = new.evidence_sha256
       and s.organization_id = new.organization_id
       and (new.activity_id is null or s.activity_id = new.activity_id)
  ) into artifact_found;

  if not artifact_found then
    raise exception 'GOVERNMENT_CROSSWALK_EVIDENCE_UNBOUND';
  end if;

  if TG_TABLE_NAME = 'government_jurisdiction_crosswalks' and new.status = 'VERIFIED' then
    if not exists (
      select 1
        from evidence_artifact_versions v
        join evidence_artifact_series s on s.id=v.series_id
        join evidence e on e.id=v.evidence_id
       where new.evidence_reference = 'db://evidence-vault/' || v.id::text
         and v.sha256 = new.evidence_sha256
         and s.organization_id = new.organization_id
         and (new.activity_id is null or s.activity_id = new.activity_id)
         and e.status = 'VERIFIED'
    ) then
      raise exception 'GOVERNMENT_CROSSWALK_EVIDENCE_NOT_VERIFIED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists government_crosswalk_request_evidence_binding on government_jurisdiction_crosswalk_requests;
create trigger government_crosswalk_request_evidence_binding
before insert or update on government_jurisdiction_crosswalk_requests
for each row execute function enforce_government_crosswalk_evidence_binding();

drop trigger if exists government_crosswalk_evidence_binding on government_jurisdiction_crosswalks;
create trigger government_crosswalk_evidence_binding
before insert or update on government_jurisdiction_crosswalks
for each row execute function enforce_government_crosswalk_evidence_binding();
