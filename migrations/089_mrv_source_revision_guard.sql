-- Tie immutable MRV snapshots to a database-maintained source revision.
-- Any mutation to an activity, verification, observation, measurement or evidence row
-- advances the activity revision. Credential issuance requires the snapshot revision
-- to still match the live source revision.

alter table activities
  add column mrv_source_revision bigint not null default 1 check (mrv_source_revision > 0);

alter table mrv_source_snapshots
  add column source_revision bigint not null default 1 check (source_revision > 0);

-- Snapshots created before source revisions existed cannot prove their live source state.
update activities a
   set mrv_source_revision = a.mrv_source_revision + 1
 where exists (select 1 from mrv_source_snapshots s where s.activity_id=a.id);

create or replace function guard_activity_mrv_source_revision()
returns trigger language plpgsql as $$
begin
  if new.mrv_source_revision is distinct from old.mrv_source_revision then
    if pg_trigger_depth() > 1 then
      return new;
    end if;
    raise exception 'MRV_SOURCE_REVISION_IS_DATABASE_MANAGED';
  end if;

  if row(
    new.organization_id,new.actor_identity_id,new.geography_id,new.activity_type,
    new.status,new.occurred_at,new.completed_at,new.created_at,new.metadata
  ) is distinct from row(
    old.organization_id,old.actor_identity_id,old.geography_id,old.activity_type,
    old.status,old.occurred_at,old.completed_at,old.created_at,old.metadata
  ) then
    new.mrv_source_revision := old.mrv_source_revision + 1;
  else
    new.mrv_source_revision := old.mrv_source_revision;
  end if;
  return new;
end;
$$;

drop trigger if exists activities_mrv_source_revision_guard on activities;
create trigger activities_mrv_source_revision_guard
before update on activities
for each row execute function guard_activity_mrv_source_revision();

create or replace function bump_activity_mrv_source_revision()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  old_activity_id uuid;
  new_activity_id uuid;
begin
  if tg_op = 'UPDATE' and to_jsonb(new) is not distinct from to_jsonb(old) then return null; end if;
  if tg_op <> 'INSERT' then old_activity_id := old.activity_id; end if;
  if tg_op <> 'DELETE' then new_activity_id := new.activity_id; end if;

  if old_activity_id is not null
     and (new_activity_id is null or old_activity_id is distinct from new_activity_id) then
    update public.activities set mrv_source_revision=mrv_source_revision+1 where id=old_activity_id;
  end if;
  if new_activity_id is not null then
    update public.activities set mrv_source_revision=mrv_source_revision+1 where id=new_activity_id;
  end if;
  return null;
end;
$$;

drop trigger if exists measurements_mrv_source_revision on measurements;
create trigger measurements_mrv_source_revision
after insert or update or delete on measurements
for each row execute function bump_activity_mrv_source_revision();

drop trigger if exists mrv_observations_source_revision on mrv_observations;
create trigger mrv_observations_source_revision
after insert or update or delete on mrv_observations
for each row execute function bump_activity_mrv_source_revision();

drop trigger if exists evidence_mrv_source_revision on evidence;
create trigger evidence_mrv_source_revision
after insert or update or delete on evidence
for each row execute function bump_activity_mrv_source_revision();

drop trigger if exists verifications_mrv_source_revision on verifications;
create trigger verifications_mrv_source_revision
after insert or update or delete on verifications
for each row execute function bump_activity_mrv_source_revision();

create or replace function validate_mrv_source_snapshot_lineage()
returns trigger language plpgsql as $$
declare
  prior_snapshot mrv_source_snapshots%rowtype;
  activity_ok boolean;
begin
  if new.source_payload->>'schema' is distinct from 'rupaykg:mrv-source-snapshot:v1'
     or new.source_payload->'activity'->>'id' is distinct from new.activity_id::text
     or new.source_payload->'verification'->>'id' is distinct from new.verification_id::text
     or new.source_payload->>'selectedEvidenceId' is distinct from new.evidence_id::text
     or new.source_payload->>'guardianPolicyId' is distinct from new.guardian_policy_id
     or new.source_payload->'activity'->>'sourceRevision' is distinct from new.source_revision::text then
    raise exception 'MRV_SOURCE_SNAPSHOT_PAYLOAD_BINDING_INVALID';
  end if;

  select exists (
    select 1
      from activities a
      join verifications v on v.id=new.verification_id and v.activity_id=a.id and v.decision='APPROVED'
      join evidence e on e.id=new.evidence_id and e.activity_id=a.id and e.status='VERIFIED'
     where a.id=new.activity_id
       and a.status='COMPLETED'
       and a.mrv_source_revision=new.source_revision
       and v.evidence_id=e.id
  ) into activity_ok;
  if not activity_ok then
    raise exception 'MRV_SOURCE_SNAPSHOT_REQUIRES_CURRENT_COMPLETED_ACTIVITY_APPROVED_VERIFICATION_AND_VERIFIED_EVIDENCE';
  end if;

  select * into prior_snapshot
    from mrv_source_snapshots
   where activity_id=new.activity_id
   order by snapshot_version desc
   limit 1
   for update;

  if new.snapshot_version=1 then
    if found or new.supersedes_snapshot_id is not null then
      raise exception 'MRV_SOURCE_SNAPSHOT_INITIAL_VERSION_INVALID';
    end if;
  else
    if not found
       or prior_snapshot.id is distinct from new.supersedes_snapshot_id
       or prior_snapshot.snapshot_version <> new.snapshot_version-1
       or prior_snapshot.source_digest = new.source_digest then
      raise exception 'MRV_SOURCE_SNAPSHOT_SUPERSESSION_LINEAGE_INVALID';
    end if;
  end if;
  return new;
end;
$$;

-- Reassert the issuance gate with a live source-revision match. Existing issued
-- credentials retain their original trust-rail lifecycle and are not retroactively revoked.
create or replace function require_guardian_hcs_mrv_for_credential()
returns trigger language plpgsql as $$
declare
  new_issuance boolean := true;
begin
  if tg_op = 'UPDATE' then
    new_issuance := old.status not in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED');
  end if;

  if new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
    if new_issuance and (
      exists (
        select 1 from activities a
         where a.id=new.activity_id and a.metadata->>'acceptanceFixture'='true'
      )
      or exists (
        select 1 from evidence e
        join verifications v on v.evidence_id=e.id
        where e.activity_id=new.activity_id
          and v.activity_id=new.activity_id
          and v.id=new.verification_id
          and e.metadata->>'acceptanceFixture'='true'
      )
    ) then
      raise exception 'ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE: acceptance fixture activity/evidence cannot back an issued registry credential';
    end if;

    if tg_op='UPDATE' and old.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
      if not exists (
        select 1 from mrv_provenance_events m
        join verifications v on v.id=new.verification_id
        where m.activity_id=new.activity_id
          and m.verification_id=new.verification_id
          and m.evidence_id=v.evidence_id
          and m.guardian_status='VERIFIED'
          and m.hcs_status='CONSENSUS_CONFIRMED'
          and m.guardian_execution_id is not null and btrim(m.guardian_execution_id)<>''
          and m.hcs_topic_id is not null and btrim(m.hcs_topic_id)<>''
          and m.hcs_transaction_id is not null and btrim(m.hcs_transaction_id)<>''
          and m.hcs_consensus_timestamp is not null and btrim(m.hcs_consensus_timestamp)<>''
          and m.integrity_hash is not null and btrim(m.integrity_hash)<>''
          and m.mirror_node_verified_at is not null
      ) then
        raise exception 'CREDENTIAL_MRV_REQUIRED: existing credential lifecycle requires its original verified Guardian, HCS and Mirror Node provenance';
      end if;
    elsif new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
      if not exists (
        select 1
          from mrv_provenance_events m
          join verifications v on v.id=new.verification_id
          join activities a on a.id=new.activity_id
          join mrv_source_snapshots s
            on s.id=m.source_snapshot_id
           and s.activity_id=m.activity_id
           and s.verification_id=m.verification_id
           and s.evidence_id=m.evidence_id
           and s.source_digest=m.source_snapshot_digest
           and s.snapshot_version=m.source_snapshot_version
           and s.source_revision=a.mrv_source_revision
           and not exists (
             select 1 from mrv_source_snapshots newer
              where newer.activity_id=s.activity_id and newer.snapshot_version>s.snapshot_version
           )
         where m.activity_id=new.activity_id
           and m.verification_id=new.verification_id
           and m.evidence_id=v.evidence_id
           and v.evidence_id=m.evidence_id
           and m.guardian_status='VERIFIED'
           and m.hcs_status='CONSENSUS_CONFIRMED'
           and m.guardian_execution_id is not null and btrim(m.guardian_execution_id)<>''
           and m.hcs_topic_id is not null and btrim(m.hcs_topic_id)<>''
           and m.hcs_transaction_id is not null and btrim(m.hcs_transaction_id)<>''
           and m.hcs_consensus_timestamp is not null and btrim(m.hcs_consensus_timestamp)<>''
           and m.integrity_hash is not null and btrim(m.integrity_hash)<>''
           and m.mirror_node_verified_at is not null
      ) then
        raise exception 'CREDENTIAL_MRV_REQUIRED: new credential issuance requires Guardian, HCS consensus, Mirror Node proof and the current source revision snapshot';
      end if;
    end if;
  end if;
  return new;
end;
$$;
