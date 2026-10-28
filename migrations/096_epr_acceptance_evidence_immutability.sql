-- Preserve the evidence/verification invariant after external EPR acceptance.
-- Once an authority acceptance is recorded, referenced artifacts cannot be rewritten
-- or invalidated in place; corrections must use a new evidence/verification record.
create or replace function prevent_epr_acceptance_evidence_invalidation()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from epr_returns r
    where r.status in ('ACCEPTED','COMPLETED')
      and r.external_confirmation_evidence_id = old.id
  ) and (
    new.activity_id is distinct from old.activity_id
    or new.content_hash is distinct from old.content_hash
    or new.content_uri is distinct from old.content_uri
    or new.status is distinct from 'VERIFIED'
  ) then
    raise exception 'evidence referenced by accepted EPR return is immutable; create a new evidence record';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_acceptance_evidence_immutable on evidence;
create trigger epr_acceptance_evidence_immutable
before update of activity_id, content_hash, content_uri, status on evidence
for each row execute function prevent_epr_acceptance_evidence_invalidation();

create or replace function prevent_epr_acceptance_verification_invalidation()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from epr_returns r
    where r.status in ('ACCEPTED','COMPLETED')
      and r.external_confirmation_verification_id = old.id
  ) then
    raise exception 'verification referenced by accepted EPR return is immutable; create a new verification record';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_acceptance_verification_immutable on verifications;
create trigger epr_acceptance_verification_immutable
before update on verifications
for each row execute function prevent_epr_acceptance_verification_invalidation();
