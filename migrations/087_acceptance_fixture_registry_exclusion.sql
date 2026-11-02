-- Refuse rollout if an acceptance fixture already backs a value-bearing credential.
-- Do not silently rewrite historical registry state; require a separate audited review.
do $preflight$
begin
  if exists (
    select 1
      from credentials c
      join activities a on a.id = c.activity_id
      left join verifications v on v.id = c.verification_id
      left join evidence e on e.id = v.evidence_id and e.activity_id = a.id
     where c.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED')
       and (
         a.metadata->>'acceptanceFixture' = 'true'
         or e.metadata->>'acceptanceFixture' = 'true'
       )
  ) then
    raise exception 'ACCEPTANCE_FIXTURE_CREDENTIAL_REQUIRES_MANUAL_REVIEW: a value-bearing credential is backed by acceptance fixture data';
  end if;
end;
$preflight$;

-- Acceptance fixtures are useful for proving the external trust rail, but must never
-- become carbon-credit registry assets. Enforce this at the database boundary.
create or replace function require_guardian_hcs_mrv_for_credential()
returns trigger language plpgsql as $$
begin
  if new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
    if exists (
      select 1
        from activities a
       where a.id = new.activity_id
         and a.metadata->>'acceptanceFixture' = 'true'
    ) or exists (
      select 1
        from evidence e
        join verifications v on v.evidence_id = e.id
       where e.activity_id = new.activity_id
         and v.activity_id = new.activity_id
         and v.id = new.verification_id
         and e.metadata->>'acceptanceFixture' = 'true'
    ) then
      raise exception 'ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE: acceptance fixture activity/evidence cannot back an issued registry credential';
    end if;

    if not exists (
      select 1
        from mrv_provenance_events m
        join verifications v on v.id = new.verification_id
        join evidence e on e.id = m.evidence_id
       where m.activity_id = new.activity_id
         and m.verification_id = new.verification_id
         and v.activity_id = m.activity_id
         and e.activity_id = m.activity_id
         and m.evidence_id = v.evidence_id
         and v.evidence_id = m.evidence_id
         and m.guardian_status = 'VERIFIED'
         and m.hcs_status = 'CONSENSUS_CONFIRMED'
         and m.guardian_execution_id is not null
         and btrim(m.guardian_execution_id) <> ''
         and m.hcs_topic_id is not null
         and btrim(m.hcs_topic_id) <> ''
         and m.hcs_transaction_id is not null
         and btrim(m.hcs_transaction_id) <> ''
         and m.hcs_consensus_timestamp is not null
         and btrim(m.hcs_consensus_timestamp) <> ''
         and m.integrity_hash is not null
         and btrim(m.integrity_hash) <> ''
         and m.mirror_node_verified_at is not null
    ) then
      raise exception 'CREDENTIAL_MRV_REQUIRED: credential issuance requires Guardian VERIFIED, Hedera HCS consensus, and persisted Mirror Node verification bound to the verified evidence';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists credentials_require_guardian_hcs_mrv on credentials;
create trigger credentials_require_guardian_hcs_mrv
before insert or update on credentials
for each row execute function require_guardian_hcs_mrv_for_credential();
