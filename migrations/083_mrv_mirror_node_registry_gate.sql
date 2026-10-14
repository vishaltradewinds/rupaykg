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
before insert or update on credentials
for each row execute function require_guardian_hcs_mrv_for_credential();

-- Any mutation of the anchored provenance tuple invalidates prior Mirror Node verification.
create or replace function clear_mrv_mirror_verification_on_anchor_change()
returns trigger language plpgsql as $$
begin
  if row(
    new.activity_id,new.verification_id,new.evidence_id,new.guardian_execution_id,new.guardian_status,
    new.hcs_status,new.hcs_topic_id,new.hcs_transaction_id,new.hcs_consensus_timestamp,new.integrity_hash
  ) is distinct from row(
    old.activity_id,old.verification_id,old.evidence_id,old.guardian_execution_id,old.guardian_status,
    old.hcs_status,old.hcs_topic_id,old.hcs_transaction_id,old.hcs_consensus_timestamp,old.integrity_hash
  ) then
    if exists (
      select 1 from credentials c
       where c.activity_id=old.activity_id and c.verification_id=old.verification_id
    ) then
      raise exception 'MRV_PROVENANCE_IMMUTABLE_AFTER_CREDENTIAL_ISSUANCE';
    end if;
    new.mirror_node_verified_at := null;
  end if;
  if old.mirror_node_verified_at is not null and new.mirror_node_verified_at is null
     and exists (
       select 1 from credentials c
        where c.activity_id=old.activity_id and c.verification_id=old.verification_id
     ) then
    raise exception 'MIRROR_NODE_PROOF_IMMUTABLE_AFTER_CREDENTIAL_ISSUANCE';
  end if;
  return new;
end;
$$;

drop trigger if exists mrv_anchor_change_clears_mirror_verification on mrv_provenance_events;
create trigger mrv_anchor_change_clears_mirror_verification
before update on mrv_provenance_events
for each row execute function clear_mrv_mirror_verification_on_anchor_change();
