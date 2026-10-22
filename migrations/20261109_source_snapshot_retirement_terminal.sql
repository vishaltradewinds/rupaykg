-- An approved snapshot's authority identity is provenance, and retirement is terminal.
-- Retired manifests remain immutable and cannot be re-approved; corrected data requires a new version.
create or replace function enforce_approved_source_snapshot_immutability()
returns trigger language plpgsql as $$
begin
  if old.validation_status = 'RETIRED' and new.validation_status <> 'RETIRED' then
    raise exception 'RETIRED_SOURCE_SNAPSHOT_STATUS_IMMUTABLE';
  end if;
  if old.validation_status = 'APPROVED' and new.validation_status not in ('APPROVED','RETIRED') then
    raise exception 'APPROVED_SOURCE_SNAPSHOT_INVALID_TRANSITION';
  end if;

  if old.validation_status in ('APPROVED','RETIRED') and (
    new.authority_code is distinct from old.authority_code
    or new.source_owner is distinct from old.source_owner
    or new.dataset_code is distinct from old.dataset_code
    or new.source_url is distinct from old.source_url
    or new.source_version is distinct from old.source_version
    or new.scope_kind is distinct from old.scope_kind
    or new.scope_code is distinct from old.scope_code
    or new.published_at is distinct from old.published_at
    or new.retrieved_at is distinct from old.retrieved_at
    or new.effective_from is distinct from old.effective_from
    or new.effective_to is distinct from old.effective_to
    or new.content_sha256 is distinct from old.content_sha256
    or new.record_count is distinct from old.record_count
    or new.accepted_record_count is distinct from old.accepted_record_count
    or new.unresolved_record_count is distinct from old.unresolved_record_count
    or new.usage_terms_reference is distinct from old.usage_terms_reference
    or new.retrieved_by_identity_id is distinct from old.retrieved_by_identity_id
    or new.reviewed_by_identity_id is distinct from old.reviewed_by_identity_id
    or new.reviewed_at is distinct from old.reviewed_at
  ) then
    raise exception 'APPROVED_SOURCE_SNAPSHOT_PROVENANCE_IMMUTABLE';
  end if;
  return new;
end;
$$;

comment on function enforce_approved_source_snapshot_immutability() is
  'Approved and retired source snapshot identity, authority, version, jurisdiction, effective dates, hash, coverage counts, terms and review provenance are immutable. Retirement is terminal; corrected material requires a new snapshot/version.';
