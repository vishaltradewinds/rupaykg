-- Verification authorization hardening.
-- The legacy 010 trigger allowed role names (VERIFIER/AUDITOR) to bypass the
-- explicit permission model introduced in 027. Keep database enforcement aligned
-- with has_verification_permission(), which requires a verified membership and
-- an explicit verification permission. The database remains authoritative.

create or replace function enforce_verification_independence()
returns trigger language plpgsql as $$
declare
  activity_actor uuid;
  evidence_activity_id uuid;
begin
  if not has_verification_permission(new.verifier_identity_id) then
    raise exception 'verifier lacks explicit verification permission';
  end if;

  if new.evidence_id is not null then
    select e.activity_id, a.actor_identity_id
      into evidence_activity_id, activity_actor
      from evidence e
      join activities a on a.id = e.activity_id
     where e.id = new.evidence_id;

    if evidence_activity_id is null then
      raise exception 'verification evidence does not exist';
    end if;

    if new.activity_id is not null and new.activity_id <> evidence_activity_id then
      raise exception 'verification activity does not match evidence activity';
    end if;
  elsif new.activity_id is not null then
    select a.actor_identity_id
      into activity_actor
      from activities a
     where a.id = new.activity_id;
  end if;

  if activity_actor is not null and activity_actor = new.verifier_identity_id then
    raise exception 'verifier cannot self-approve activity evidence';
  end if;

  return new;
end;
$$;

drop trigger if exists verification_independence_guard on verifications;
create trigger verification_independence_guard
before insert on verifications
for each row execute function enforce_verification_independence();

-- Verify the stored artifact digest at the database boundary as well as in the
-- API. This prevents direct SQL writers from pairing arbitrary bytes with a
-- plausible-looking SHA-256 string.
create or replace function enforce_evidence_artifact_digest()
returns trigger language plpgsql as $$
declare
  actual_hash text;
  series_org uuid;
  series_activity uuid;
  evidence_activity uuid;
  evidence_hash text;
begin
  actual_hash := encode(digest(new.content, 'sha256'), 'hex');
  if actual_hash <> new.sha256 then
    raise exception 'evidence artifact SHA-256 does not match stored bytes';
  end if;

  select s.organization_id, s.activity_id, s.evidence_type
    into series_org, series_activity, series_type_value
    from evidence_artifact_series s
   where s.id = new.series_id;

  select e.activity_id, e.content_hash, e.evidence_type, a.organization_id
    into evidence_activity, evidence_hash, evidence_type_value, evidence_org_id
    from evidence e
    join activities a on a.id = e.activity_id
   where e.id = new.evidence_id;

  if series_org is null or series_activity is null or evidence_activity is null then
    raise exception 'evidence artifact series or evidence does not exist';
  end if;
  if series_activity <> evidence_activity then
    raise exception 'evidence artifact activity does not match its series';
  end if;
  if series_org <> evidence_org_id then
    raise exception 'evidence artifact organization does not match its activity';
  end if;
  if series_type_value <> evidence_type_value then
    raise exception 'evidence artifact type does not match its series';
  end if;
  if evidence_hash is distinct from actual_hash then
    raise exception 'evidence artifact digest does not match canonical evidence hash';
  end if;

  return new;
end;
$$;

drop trigger if exists evidence_artifact_digest_guard on evidence_artifact_versions;
create trigger evidence_artifact_digest_guard
before insert on evidence_artifact_versions
for each row execute function enforce_evidence_artifact_digest();
