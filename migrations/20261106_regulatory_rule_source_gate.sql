-- Approved regulatory rules must be grounded in an approved, scope-compatible source snapshot.
-- This is an internal provenance gate, not a legal interpretation or external certification.

create or replace function enforce_regulatory_rule_source_gate()
returns trigger language plpgsql as $$
declare snapshot record;
begin
  if new.status = 'APPROVED' then
    select id, validation_status, scope_kind, scope_code, effective_from, effective_to,
           retrieved_at, content_sha256, record_count, accepted_record_count,
           unresolved_record_count, usage_terms_reference
      into snapshot
      from authoritative_source_snapshots
     where id = new.source_snapshot_id
     for share;

    if not found or snapshot.validation_status <> 'APPROVED' then
      raise exception 'REGULATORY_RULE_SOURCE_SNAPSHOT_NOT_APPROVED';
    end if;

    -- A national source can support a narrower rule. A narrower or unrelated
    -- source cannot silently justify a broader rule. Cross-level equivalence
    -- must be resolved by a separate reviewed jurisdiction crosswalk.
    if not (
      snapshot.scope_kind = 'INDIA'
      or (
        snapshot.scope_kind = new.jurisdiction_scope_kind
        and coalesce(snapshot.scope_code, '') = coalesce(new.jurisdiction_scope_code, '')
      )
    ) then
      raise exception 'REGULATORY_RULE_SOURCE_SCOPE_MISMATCH';
    end if;

    if new.effective_from < coalesce(snapshot.effective_from, new.effective_from)
       or (snapshot.effective_to is not null and
           coalesce(new.effective_to, 'infinity'::date) > snapshot.effective_to) then
      raise exception 'REGULATORY_RULE_EFFECTIVE_PERIOD_OUTSIDE_SOURCE';
    end if;

    if new.reviewed_by_identity_id is null or new.reviewed_at is null then
      raise exception 'REGULATORY_RULE_APPROVAL_REVIEW_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists regulatory_rule_source_gate on regulatory_rule_versions;
create trigger regulatory_rule_source_gate
before insert or update of status, source_snapshot_id, jurisdiction_scope_kind,
  jurisdiction_scope_code, effective_from, effective_to, reviewed_by_identity_id,
  reviewed_at
on regulatory_rule_versions
for each row execute function enforce_regulatory_rule_source_gate();

comment on function enforce_regulatory_rule_source_gate() is
  'Fail-closed internal provenance gate: approved regulatory rules require an approved source snapshot with compatible jurisdiction scope and effective period. Does not establish legal validity or government approval.';
