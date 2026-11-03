-- Explicit per-activity statutory/methodology eligibility decision.
-- Technical MRV provenance is necessary but never sufficient to issue a registry credential.
create table activity_registry_eligibility_decisions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  verification_id uuid not null references verifications(id),
  evidence_id uuid not null references evidence(id),
  methodology_version_id uuid not null references methodology_versions(id),
  geography_id uuid not null references geography(id),
  decision text not null check (decision in ('APPROVED','REJECTED','REQUIRES_REVIEW')),
  statutory_basis jsonb not null check (jsonb_typeof(statutory_basis) = 'object' and statutory_basis <> '{}'::jsonb),
  permit_and_authority_evidence jsonb not null check (jsonb_typeof(permit_and_authority_evidence) = 'array'),
  applicability_rationale text not null check (length(btrim(applicability_rationale)) > 0),
  independent_review_reference text not null check (length(btrim(independent_review_reference)) > 0),
  reviewer_identity_id uuid not null references identities(id),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (activity_id, verification_id, evidence_id, methodology_version_id, independent_review_reference)
);
create index activity_registry_eligibility_lookup_idx
  on activity_registry_eligibility_decisions(activity_id, verification_id, evidence_id, methodology_version_id, created_at desc);
create or replace function prevent_activity_registry_eligibility_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'activity registry eligibility decisions are append-only; create a new review decision';
end;
$$;
create trigger activity_registry_eligibility_append_only
before update or delete on activity_registry_eligibility_decisions
for each row execute function prevent_activity_registry_eligibility_mutation();
create or replace function enforce_activity_registry_eligibility_binding()
returns trigger language plpgsql as $$
declare
  v_activity uuid;
  e_activity uuid;
  m_code text;
begin
  select activity_id into v_activity from verifications where id = new.verification_id and evidence_id = new.evidence_id and decision = 'APPROVED';
  select activity_id into e_activity from evidence where id = new.evidence_id and status = 'VERIFIED';
  select methodology_code into m_code from methodology_versions where id = new.methodology_version_id and governance_status = 'PRODUCTION_ELIGIBLE';
  if v_activity is distinct from new.activity_id or e_activity is distinct from new.activity_id then
    raise exception 'eligibility decision must bind approved verification and verified evidence for the same activity';
  end if;
  if m_code is null then
    raise exception 'eligibility decision requires a production-eligible methodology version';
  end if;
  if not exists (select 1 from activities a where a.id = new.activity_id and a.geography_id = new.geography_id) then
    raise exception 'eligibility decision geography must match the activity geography';
  end if;
  return new;
end;
$$;
create trigger activity_registry_eligibility_binding_guard
before insert on activity_registry_eligibility_decisions
for each row execute function enforce_activity_registry_eligibility_binding();
comment on table activity_registry_eligibility_decisions is
  'Append-only activity-specific statutory/methodology eligibility decisions. Not a government approval or registry issuance; requires independent evidence and current validity.';
