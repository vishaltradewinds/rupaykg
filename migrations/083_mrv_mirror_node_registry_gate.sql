-- Registry issuance requires persisted, successful Mirror Node verification of the exact HCS anchor.
-- Existing provenance remains ineligible until the authorized verification endpoint confirms it.
alter table mrv_provenance_events
  add column if not exists mirror_node_verified_at timestamptz;

create index if not exists mrv_provenance_registry_gate_idx
  on mrv_provenance_events(activity_id, verification_id, evidence_id, mirror_node_verified_at)
  where mirror_node_verified_at is not null;

create or replace function require_guardian_hcs_mrv_for_credential()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1
      from mrv_provenance_events m
      join verifications v on v.id = new.verification_id
     where m.activity_id = new.activity_id
       and m.verification_id = new.verification_id
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
  return new;
end;
$$;

drop trigger if exists credentials_require_guardian_hcs_mrv on credentials;
create trigger credentials_require_guardian_hcs_mrv
before insert on credentials
for each row execute function require_guardian_hcs_mrv_for_credential();
