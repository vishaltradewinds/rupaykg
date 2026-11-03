-- Versioned, immutable MRV source snapshots.
-- Corrections create a new snapshot linked to the previous one; prior snapshots are never overwritten.

create table mrv_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  verification_id uuid not null references verifications(id),
  evidence_id uuid not null references evidence(id),
  guardian_policy_id text not null,
  methodology_code text,
  snapshot_version integer not null check (snapshot_version > 0),
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  source_payload jsonb not null,
  supersedes_snapshot_id uuid references mrv_source_snapshots(id) on delete restrict,
  correction_reason text,
  created_by_identity_id uuid not null references identities(id),
  created_at timestamptz not null default now(),
  unique(activity_id, snapshot_version),
  check (
    (snapshot_version = 1 and supersedes_snapshot_id is null and correction_reason is null)
    or
    (snapshot_version > 1 and supersedes_snapshot_id is not null and length(btrim(correction_reason)) between 10 and 2000)
  )
);

create index mrv_source_snapshots_activity_version_idx
  on mrv_source_snapshots(activity_id, snapshot_version desc);
create index mrv_source_snapshots_digest_idx
  on mrv_source_snapshots(activity_id, source_digest);

alter table mrv_provenance_events
  add column source_snapshot_id uuid references mrv_source_snapshots(id) on delete restrict,
  add column source_snapshot_digest text,
  add column source_snapshot_version integer;

alter table mrv_provenance_events
  add constraint mrv_provenance_source_snapshot_binding_check
  check (
    (source_snapshot_id is null and source_snapshot_digest is null and source_snapshot_version is null)
    or
    (source_snapshot_id is not null and source_snapshot_digest ~ '^[0-9a-f]{64}$' and source_snapshot_version > 0)
  );

create index mrv_provenance_source_snapshot_idx
  on mrv_provenance_events(source_snapshot_id)
  where source_snapshot_id is not null;

create or replace function prevent_mrv_source_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'MRV source snapshots are immutable; create a superseding correction snapshot';
end;
$$;

drop trigger if exists mrv_source_snapshots_immutable on mrv_source_snapshots;
create trigger mrv_source_snapshots_immutable
before update or delete on mrv_source_snapshots
for each row execute function prevent_mrv_source_snapshot_mutation();

-- Credential issuance now requires provenance bound to the exact immutable source snapshot.
create or replace function require_guardian_hcs_mrv_for_credential()
returns trigger language plpgsql as $$
begin
  if new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
    if not exists (
      select 1
        from mrv_provenance_events m
        join verifications v on v.id = new.verification_id
        join mrv_source_snapshots s
          on s.id = m.source_snapshot_id
         and s.activity_id = m.activity_id
         and s.verification_id = m.verification_id
         and s.evidence_id = m.evidence_id
         and s.source_digest = m.source_snapshot_digest
         and s.snapshot_version = m.source_snapshot_version
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
      raise exception 'CREDENTIAL_MRV_REQUIRED: Guardian, HCS consensus, Mirror Node proof, and immutable source snapshot binding are required before credential issuance';
    end if;
  end if;
  return new;
end;
$$;

-- Any change to the anchor tuple, including its source snapshot binding, invalidates Mirror Node proof.
create or replace function clear_mrv_mirror_verification_on_anchor_change()
returns trigger language plpgsql as $$
begin
  if row(
    new.activity_id,new.verification_id,new.evidence_id,new.guardian_execution_id,new.guardian_status,
    new.hcs_status,new.hcs_topic_id,new.hcs_transaction_id,new.hcs_consensus_timestamp,new.integrity_hash,
    new.source_snapshot_id,new.source_snapshot_digest,new.source_snapshot_version
  ) is distinct from row(
    old.activity_id,old.verification_id,old.evidence_id,old.guardian_execution_id,old.guardian_status,
    old.hcs_status,old.hcs_topic_id,old.hcs_transaction_id,old.hcs_consensus_timestamp,old.integrity_hash,
    old.source_snapshot_id,old.source_snapshot_digest,old.source_snapshot_version
  ) then
    if exists (
      select 1 from credentials c
       where c.activity_id=old.activity_id and c.verification_id=old.verification_id
         and c.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED')
    ) then
      raise exception 'MRV_PROVENANCE_IMMUTABLE_AFTER_CREDENTIAL_ISSUANCE';
    end if;
    new.mirror_node_verified_at := null;
  end if;
  if old.mirror_node_verified_at is not null and new.mirror_node_verified_at is null
     and exists (
       select 1 from credentials c
        where c.activity_id=old.activity_id and c.verification_id=old.verification_id
         and c.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED')
     ) then
    raise exception 'MIRROR_NODE_PROOF_IMMUTABLE_AFTER_CREDENTIAL_ISSUANCE';
  end if;
  return new;
end;
$$;
