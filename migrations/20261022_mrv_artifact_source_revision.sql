-- Artifact version and independent review changes are part of the MRV source state.
-- Keep activity source revision current when new vault versions/reviews are recorded.

create or replace function bump_mrv_source_revision_from_evidence_artifact()
returns trigger language plpgsql as $$
declare
  old_evidence_id uuid;
  new_evidence_id uuid;
  old_activity_id uuid;
  new_activity_id uuid;
begin
  if tg_op = 'UPDATE' and to_jsonb(new) is not distinct from to_jsonb(old) then return null; end if;
  if tg_op <> 'INSERT' then old_evidence_id := old.evidence_id; end if;
  if tg_op <> 'DELETE' then new_evidence_id := new.evidence_id; end if;

  if old_evidence_id is not null then
    select activity_id into old_activity_id from evidence where id=old_evidence_id;
  end if;
  if new_evidence_id is not null then
    select activity_id into new_activity_id from evidence where id=new_evidence_id;
  end if;

  if old_activity_id is not null
     and (new_activity_id is null or old_activity_id is distinct from new_activity_id) then
    update activities set mrv_source_revision=mrv_source_revision+1 where id=old_activity_id;
  end if;
  if new_activity_id is not null then
    update activities set mrv_source_revision=mrv_source_revision+1 where id=new_activity_id;
  end if;
  return null;
end;
$$;

drop trigger if exists evidence_artifact_versions_mrv_source_revision on evidence_artifact_versions;
create trigger evidence_artifact_versions_mrv_source_revision
after insert or update or delete on evidence_artifact_versions
for each row execute function bump_mrv_source_revision_from_evidence_artifact();

drop trigger if exists evidence_artifact_reviews_mrv_source_revision on evidence_artifact_reviews;
create trigger evidence_artifact_reviews_mrv_source_revision
after insert or update or delete on evidence_artifact_reviews
for each row execute function bump_mrv_source_revision_from_evidence_artifact();


drop trigger if exists evidence_artifact_series_mrv_source_revision on evidence_artifact_series;
create trigger evidence_artifact_series_mrv_source_revision
after insert or update or delete on evidence_artifact_series
for each row execute function bump_activity_mrv_source_revision();
