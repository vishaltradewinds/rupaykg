-- Bind evidence-vault ownership through the exact activity/evidence/series chain.
-- This is additive and fails closed if existing vault rows cannot be reconciled.
alter table activities
  add constraint activities_id_organization_unique unique (id, organization_id);

alter table evidence
  add constraint evidence_id_activity_unique unique (id, activity_id);

alter table evidence_artifact_series
  add constraint evidence_artifact_series_id_activity_unique unique (id, activity_id);

alter table evidence_artifact_series
  add constraint evidence_artifact_series_activity_org_fk
  foreign key (activity_id, organization_id)
  references activities(id, organization_id)
  not valid;

alter table evidence_artifact_series
  validate constraint evidence_artifact_series_activity_org_fk;

alter table evidence_artifact_versions
  add column activity_id uuid;

update evidence_artifact_versions v
   set activity_id = s.activity_id
  from evidence_artifact_series s
 where s.id = v.series_id
   and v.activity_id is null;

do $$
begin
  if exists (
    select 1
      from evidence_artifact_versions v
      left join evidence_artifact_series s on s.id = v.series_id
      left join evidence e on e.id = v.evidence_id
     where s.id is null
        or e.id is null
        or v.activity_id is null
        or v.activity_id is distinct from s.activity_id
        or v.activity_id is distinct from e.activity_id
  ) then
    raise exception 'evidence artifact tenant integrity preflight failed; resolve series/evidence activity mismatches before applying';
  end if;
end;
$$;

alter table evidence_artifact_versions
  alter column activity_id set not null;

alter table evidence_artifact_versions
  add constraint evidence_artifact_versions_id_evidence_unique unique (id, evidence_id);

alter table evidence_artifact_versions
  add constraint evidence_artifact_versions_series_activity_fk
  foreign key (series_id, activity_id)
  references evidence_artifact_series(id, activity_id)
  not valid;

alter table evidence_artifact_versions
  validate constraint evidence_artifact_versions_series_activity_fk;

alter table evidence_artifact_versions
  add constraint evidence_artifact_versions_evidence_activity_fk
  foreign key (evidence_id, activity_id)
  references evidence(id, activity_id)
  not valid;

alter table evidence_artifact_versions
  validate constraint evidence_artifact_versions_evidence_activity_fk;

alter table evidence_artifact_reviews
  add constraint evidence_artifact_reviews_version_evidence_fk
  foreign key (artifact_version_id, evidence_id)
  references evidence_artifact_versions(id, evidence_id)
  not valid;

alter table evidence_artifact_reviews
  validate constraint evidence_artifact_reviews_version_evidence_fk;
