-- Fail closed when an acceptance-only geography is used by a value-bearing registry credential.
-- Do not edit historical migrations 081/087/106/107: this additive migration closes the
-- geography-metadata gap in the current credential eligibility guard.
create or replace function require_activity_registry_eligibility_for_credential()
returns trigger language plpgsql as $$
declare
  v_evidence_id uuid;
  v_methodology_code text;
begin
  if new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
    if exists (
      select 1 from activities a
       where a.id = new.activity_id and a.metadata->>'acceptanceFixture' = 'true'
    ) or exists (
      select 1 from evidence e
      join verifications v on v.evidence_id=e.id
       where e.activity_id=new.activity_id and v.id=new.verification_id
         and e.metadata->>'acceptanceFixture'='true'
    ) then
      raise exception 'ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE: acceptance fixture activity/evidence cannot back an issued registry credential';
    end if;

    if exists (
      select 1
        from activities a
        join geography g on g.id = a.geography_id
       where a.id = new.activity_id
         and g.metadata->>'acceptanceFixture' = 'true'
    ) then
      raise exception 'ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE: acceptance fixture geography cannot back an issued registry credential';
    end if;

    if not exists (
      select 1
        from mrv_provenance_events m
        join verifications v on v.id=new.verification_id
        join evidence e on e.id=m.evidence_id
       where m.activity_id=new.activity_id
         and m.verification_id=new.verification_id
         and v.activity_id=m.activity_id
         and e.activity_id=m.activity_id
         and v.evidence_id=m.evidence_id
         and m.guardian_status='VERIFIED'
         and m.hcs_status='CONSENSUS_CONFIRMED'
         and nullif(btrim(m.guardian_execution_id),'') is not null
         and nullif(btrim(m.hcs_topic_id),'') is not null
         and nullif(btrim(m.hcs_transaction_id),'') is not null
         and nullif(btrim(m.hcs_consensus_timestamp),'') is not null
         and nullif(btrim(m.integrity_hash),'') is not null
         and m.mirror_node_verified_at is not null
    ) then
      raise exception 'CREDENTIAL_MRV_REQUIRED: credential issuance requires Guardian VERIFIED, Hedera HCS consensus, and persisted Mirror Node verification bound to the verified evidence';
    end if;

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
