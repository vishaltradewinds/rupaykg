-- Database-level issuance guard: API route checks are not the only enforcement boundary.
create or replace function require_activity_registry_eligibility_for_credential()
returns trigger language plpgsql as $$
declare
  v_evidence_id uuid;
  v_methodology_code text;
begin
  if new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
    if new.methodology_version_id is null or new.verification_id is null then
      raise exception 'REGULATORY_ELIGIBILITY_REQUIRED: credential requires a bound methodology version and verification';
    end if;
    select v.evidence_id into v_evidence_id
      from verifications v
     where v.id = new.verification_id and v.activity_id = new.activity_id and v.decision = 'APPROVED';
    select methodology_code into v_methodology_code
      from methodology_versions
     where id = new.methodology_version_id and governance_status = 'PRODUCTION_ELIGIBLE';
    if v_evidence_id is null or v_methodology_code is null then
      raise exception 'REGULATORY_ELIGIBILITY_REQUIRED: approved verification and production-eligible methodology are required';
    end if;
    if not exists (
      select 1
        from activity_registry_eligibility_decisions d
        join activities a on a.id = d.activity_id
       where d.activity_id = new.activity_id
         and d.verification_id = new.verification_id
         and d.evidence_id = v_evidence_id
         and d.methodology_version_id = new.methodology_version_id
         and d.geography_id = a.geography_id
         and d.decision = 'APPROVED'
         and d.effective_from <= current_date
         and (d.effective_to is null or d.effective_to >= current_date)
         and exists (
           select 1 from mrv_provenance_events m
            where m.activity_id = d.activity_id
              and m.verification_id = d.verification_id
              and m.evidence_id = d.evidence_id
              and m.methodology_code = v_methodology_code
              and m.guardian_status = 'VERIFIED'
              and m.hcs_status = 'CONSENSUS_CONFIRMED'
              and m.mirror_node_verified_at is not null
         )
    ) then
      raise exception 'REGULATORY_ELIGIBILITY_REQUIRED: current activity-specific statutory and methodology approval bound to the verified MRV evidence is required';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists credentials_activity_registry_eligibility_guard on credentials;
create trigger credentials_activity_registry_eligibility_guard
before insert or update on credentials
for each row execute function require_activity_registry_eligibility_for_credential();
