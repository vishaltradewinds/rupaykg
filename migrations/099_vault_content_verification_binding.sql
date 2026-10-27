-- Make stored bytes authoritative and require a vault verification to cite the review
-- decision made by the same reviewer for that evidence.
create or replace function guard_evidence_artifact_content()
returns trigger language plpgsql as $$
declare e record;
begin
  select activity_id, evidence_type, content_hash, content_uri into e
  from evidence where id=new.evidence_id;
  if e.activity_id is null then raise exception 'artifact requires canonical evidence'; end if;
  if e.activity_id is distinct from (select activity_id from evidence_artifact_series where id=new.series_id)
     or e.evidence_type is distinct from (select evidence_type from evidence_artifact_series where id=new.series_id) then
    raise exception 'artifact, series and canonical evidence activity/type must match';
  end if;
  if new.sha256 is distinct from encode(digest(new.content,'sha256'),'hex')
     or new.size_bytes is distinct from octet_length(new.content)
     or e.content_hash is distinct from new.sha256 then
    raise exception 'artifact digest and size must match stored bytes and canonical evidence hash';
  end if;
  if e.content_uri is not null and e.content_uri not in ('db://evidence-vault/pending','db://evidence-vault/'||new.id::text) then
    raise exception 'canonical evidence pointer must reference its immutable artifact';
  end if;
  return new;
end; $$;
drop trigger if exists evidence_artifact_content_guard on evidence_artifact_versions;
create trigger evidence_artifact_content_guard before insert on evidence_artifact_versions
for each row execute function guard_evidence_artifact_content();

create or replace function guard_vault_verification_review()
returns trigger language plpgsql as $$
declare is_vault boolean; has_review boolean;
begin
  if new.evidence_id is null then return new; end if;
  select exists(select 1 from evidence_artifact_versions where evidence_id=new.evidence_id) into is_vault;
  if not is_vault then return new; end if;
  select exists(
    select 1 from evidence_artifact_reviews r
    where r.evidence_id=new.evidence_id
      and r.reviewer_identity_id=new.verifier_identity_id
      and r.decision=case when new.decision='APPROVED' then 'APPROVED' else 'REJECTED' end
  ) into has_review;
  if not has_review then
    raise exception 'vault verification must match an append-only review by the same verifier and decision';
  end if;
  return new;
end; $$;
drop trigger if exists vault_verification_review_binding_guard on verifications;
create trigger vault_verification_review_binding_guard before insert or update on verifications
for each row execute function guard_vault_verification_review();
