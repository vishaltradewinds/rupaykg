-- Prevent internal EPR workflow state from being mistaken for external
-- authority acceptance. External acceptance must be evidence-backed and reviewed.
alter table epr_returns
  add column if not exists external_authority_name text,
  add column if not exists external_confirmation_evidence_id uuid references evidence(id),
  add column if not exists external_confirmation_verification_id uuid references verifications(id),
  add column if not exists external_authority_confirmed_at timestamptz;

create or replace function enforce_epr_external_acceptance_evidence()
returns trigger
language plpgsql
as $$
declare
  confirmation_ok boolean;
begin
  if new.status in ('ACCEPTED', 'COMPLETED') then
    if new.external_reference is null or btrim(new.external_reference) = ''
       or new.external_authority_name is null or btrim(new.external_authority_name) = ''
       or new.external_confirmation_evidence_id is null
       or new.external_confirmation_verification_id is null
       or new.external_authority_confirmed_at is null then
      raise exception 'EPR external acceptance requires authority, reference, confirmation evidence, approved verification and confirmation timestamp';
    end if;

    select exists(
      select 1
      from evidence e
      join activities a on a.id=e.activity_id
      join verifications v on v.id=new.external_confirmation_verification_id
        and v.evidence_id=e.id and v.decision='APPROVED'
      where e.id=new.external_confirmation_evidence_id
        and e.status='VERIFIED'
        and (e.content_hash is not null or e.content_uri is not null)
        and a.organization_id=new.organization_id
        and a.geography_id is not null
        and organization_has_geography_scope(a.organization_id,a.geography_id)
    ) into confirmation_ok;

    if not confirmation_ok then
      raise exception 'EPR external acceptance evidence must be verified, approved, provenance-backed and organization/geography scoped';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists epr_external_acceptance_evidence_guard on epr_returns;
create trigger epr_external_acceptance_evidence_guard
before insert or update of organization_id, status, external_reference, external_authority_name,
  external_confirmation_evidence_id, external_confirmation_verification_id,
  external_authority_confirmed_at
on epr_returns
for each row execute function enforce_epr_external_acceptance_evidence();

comment on column epr_returns.external_authority_name is
  'Authority/registry that externally confirmed the return; never inferred from an internal workflow state.';
comment on column epr_returns.external_confirmation_evidence_id is
  'Verified evidence artifact for the external authority/registry response.';
comment on column epr_returns.external_confirmation_verification_id is
  'Approved verification linked to the external confirmation evidence.';
