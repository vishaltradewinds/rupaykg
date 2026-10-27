-- Preserve the identity and scope of a vault series and bind each review to its exact artifact.
create or replace function guard_evidence_artifact_series()
returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'evidence artifact series cannot be deleted'; end if;
  if new.organization_id is distinct from old.organization_id
     or new.activity_id is distinct from old.activity_id
     or new.evidence_type is distinct from old.evidence_type
     or new.created_by_identity_id is distinct from old.created_by_identity_id
     or new.created_at is distinct from old.created_at then
    raise exception 'evidence artifact series provenance is immutable';
  end if;
  return new;
end; $$;
drop trigger if exists evidence_artifact_series_immutable on evidence_artifact_series;
create trigger evidence_artifact_series_immutable before update or delete on evidence_artifact_series
for each row execute function guard_evidence_artifact_series();

create or replace function guard_artifact_review_binding()
returns trigger language plpgsql as $$
declare v record; allowed boolean;
begin
  select v.evidence_id, v.uploaded_by_identity_id, s.organization_id, s.activity_id, s.evidence_type
  into v from evidence_artifact_versions v
  join evidence_artifact_series s on s.id=v.series_id
  where v.id=new.artifact_version_id;
  if v.evidence_id is null or v.evidence_id is distinct from new.evidence_id then
    raise exception 'review must reference the exact artifact version for its evidence';
  end if;
  if v.uploaded_by_identity_id=new.reviewer_identity_id then
    raise exception 'evidence uploader cannot review their own artifact';
  end if;
  select exists (
    select 1 from organization_memberships m
    join roles r on r.id=m.role_id join identities i on i.id=m.identity_id
    where m.identity_id=new.reviewer_identity_id and m.organization_id=v.organization_id
      and m.status='VERIFIED' and i.status='VERIFIED' and i.suspended_at is null
      and r.permissions @> '["evidence:review"]'::jsonb
      and (r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
        or r.permissions @> '["verification:approve"]'::jsonb
        or r.permissions @> '["verification.approve"]'::jsonb)
  ) into allowed;
  if not allowed then raise exception 'reviewer requires active review and verification permissions in the owning organization'; end if;
  return new;
end; $$;
drop trigger if exists evidence_artifact_review_binding_guard on evidence_artifact_reviews;
create trigger evidence_artifact_review_binding_guard before insert on evidence_artifact_reviews
for each row execute function guard_artifact_review_binding();
