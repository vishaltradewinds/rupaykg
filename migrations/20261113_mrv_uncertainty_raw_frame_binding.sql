-- Forward-only MRV measurement integrity records.
-- Extend the evidence-vault media allow-list for byte-exact instrument frames.
alter table evidence_artifact_versions drop constraint if exists evidence_artifact_versions_media_type_check;
alter table evidence_artifact_versions add constraint evidence_artifact_versions_media_type_check
  check (media_type in ('application/pdf','image/jpeg','image/png','text/csv','text/plain','application/json','application/octet-stream'));

-- This migration stores reviewed parameter uncertainty as immutable, evidence-bound
-- records and binds exact raw-frame evidence-vault versions to measurement rows.
-- It does not establish a universal uncertainty acceptance threshold.

create table mrv_instrument_parameter_uncertainty (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references mrv_instruments(id) on delete restrict,
  parameter_spec_id uuid not null references mrv_instrument_parameter_specs(id) on delete restrict,
  parameter_code text not null check (btrim(parameter_code) <> ''),
  parameter_unit text not null check (btrim(parameter_unit) <> ''),
  uncertainty_kind text not null check (uncertainty_kind in ('ABSOLUTE','RELATIVE')),
  uncertainty_value numeric(24,12) not null check (uncertainty_value >= 0),
  uncertainty_unit text not null check (btrim(uncertainty_unit) <> ''),
  uncertainty_expression text not null check (uncertainty_expression in ('STANDARD','EXPANDED')),
  coverage_factor numeric(16,8),
  confidence_level_percent numeric(8,5),
  calibration_artifact_version_id uuid not null references evidence_artifact_versions(id) on delete restrict,
  calibration_artifact_sha256 text not null check (calibration_artifact_sha256 ~ '^[0-9a-fA-F]{64}$'),
  decision_rule_id text not null check (btrim(decision_rule_id) <> ''),
  reviewed_by_identity_id uuid not null references identities(id),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  check ((uncertainty_kind='ABSOLUTE' and uncertainty_unit=parameter_unit)
      or (uncertainty_kind='RELATIVE' and uncertainty_unit='%')),
  check ((uncertainty_expression='STANDARD' and coverage_factor is null)
      or (uncertainty_expression='EXPANDED' and coverage_factor > 0)),
  check (confidence_level_percent is null or (confidence_level_percent > 0 and confidence_level_percent < 100))
);

create index mrv_parameter_uncertainty_lookup_idx
  on mrv_instrument_parameter_uncertainty(instrument_id, lower(parameter_code), created_at desc);

create or replace function guard_mrv_parameter_uncertainty_insert()
returns trigger language plpgsql as $$
declare
  spec record;
  artifact record;
begin
  select s.parameter_code,s.unit,s.instrument_id
    into spec from mrv_instrument_parameter_specs s
   where s.id=new.parameter_spec_id for key share;
  if not found or spec.instrument_id is distinct from new.instrument_id
     or lower(btrim(spec.parameter_code)) <> lower(btrim(new.parameter_code))
     or spec.unit <> new.parameter_unit then
    raise exception 'MRV uncertainty must match its exact instrument parameter specification';
  end if;
  select v.id,v.sha256,v.content,v.size_bytes,e.content_hash,e.status,s.organization_id
    into artifact
    from evidence_artifact_versions v
    join evidence e on e.id=v.evidence_id
    join evidence_artifact_series s on s.id=v.series_id
   where v.id=new.calibration_artifact_version_id;
  if not found or artifact.sha256 <> lower(new.calibration_artifact_sha256)
     or octet_length(artifact.content) <> artifact.size_bytes
     or encode(digest(artifact.content,'sha256'),'hex') <> artifact.sha256
     or artifact.content_hash <> artifact.sha256 or artifact.status <> 'VERIFIED' then
    raise exception 'MRV uncertainty calibration artifact bytes, hash or review status are invalid';
  end if;
  if not exists (
    select 1 from mrv_instruments i
     where i.id=new.instrument_id and i.organization_id=artifact.organization_id
       and i.approval_status='VERIFIED'
       and i.calibration_evidence_artifact_version_id=new.calibration_artifact_version_id
  ) then
    raise exception 'MRV uncertainty calibration artifact must belong to the verified instrument organization';
  end if;
  if not exists (
    select 1 from evidence_artifact_reviews r
     where r.evidence_id=(select evidence_id from evidence_artifact_versions where id=new.calibration_artifact_version_id)
       and r.artifact_version_id=new.calibration_artifact_version_id
       and r.reviewer_identity_id <> (select uploaded_by_identity_id from evidence_artifact_versions where id=new.calibration_artifact_version_id)
       and r.reviewer_identity_id = new.reviewed_by_identity_id
       and new.reviewed_at >= r.created_at
       and r.id=(select latest.id from evidence_artifact_reviews latest
                  where latest.evidence_id=r.evidence_id and latest.artifact_version_id=r.artifact_version_id
                  order by latest.review_sequence desc limit 1)
       and r.decision='APPROVED'
  ) then
    raise exception 'MRV uncertainty calibration artifact requires latest independent APPROVED review';
  end if;
  if new.reviewed_at > clock_timestamp() then
    raise exception 'MRV uncertainty review timestamp cannot be in the future';
  end if;
  return new;
end;
$$;

create trigger mrv_parameter_uncertainty_insert_guard
before insert on mrv_instrument_parameter_uncertainty
for each row execute function guard_mrv_parameter_uncertainty_insert();

create or replace function mrv_parameter_uncertainty_is_current(record_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
      from mrv_instrument_parameter_uncertainty u
      join evidence_artifact_versions v on v.id=u.calibration_artifact_version_id
      join evidence e on e.id=v.evidence_id
      join evidence_artifact_series s on s.id=v.series_id
      join mrv_instruments i on i.id=u.instrument_id
     where u.id=record_id
       and i.approval_status='VERIFIED'
       and i.calibration_evidence_artifact_version_id=v.id
       and s.organization_id=i.organization_id
       and v.sha256=lower(u.calibration_artifact_sha256)
       and e.content_hash=v.sha256
       and e.status='VERIFIED'
       and octet_length(v.content)=v.size_bytes
       and encode(digest(v.content,'sha256'),'hex')=v.sha256
       and exists (
         select 1 from evidence_artifact_reviews r
          where r.evidence_id=e.id and r.artifact_version_id=v.id
            and r.reviewer_identity_id=u.reviewed_by_identity_id
            and r.reviewer_identity_id<>v.uploaded_by_identity_id
            and r.id=(select latest.id from evidence_artifact_reviews latest
                       where latest.evidence_id=e.id and latest.artifact_version_id=v.id
                       order by latest.review_sequence desc limit 1)
            and r.decision='APPROVED'
       )
  );
$$;

create or replace function prevent_mrv_parameter_uncertainty_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'MRV parameter uncertainty records are immutable; create a superseding reviewed record';
end;
$$;
create trigger mrv_parameter_uncertainty_append_only
before update or delete on mrv_instrument_parameter_uncertainty
for each row execute function prevent_mrv_parameter_uncertainty_mutation();

alter table measurements
  add column mrv_uncertainty_record_id uuid references mrv_instrument_parameter_uncertainty(id) on delete restrict,
  add column raw_frame_artifact_version_id uuid references evidence_artifact_versions(id) on delete restrict,
  add column raw_frame_sha256 text,
  add constraint measurements_raw_frame_sha256_format
    check (raw_frame_sha256 is null or raw_frame_sha256 ~ '^[0-9a-fA-F]{64}$'),
  add constraint measurements_raw_frame_binding_pair
    check ((raw_frame_artifact_version_id is null and raw_frame_sha256 is null)
        or (raw_frame_artifact_version_id is not null and raw_frame_sha256 is not null));

alter table mrv_observations
  add column mrv_uncertainty_record_id uuid references mrv_instrument_parameter_uncertainty(id) on delete restrict,
  add column raw_frame_artifact_version_id uuid references evidence_artifact_versions(id) on delete restrict,
  add column raw_frame_sha256 text,
  add constraint mrv_observations_raw_frame_sha256_format
    check (raw_frame_sha256 is null or raw_frame_sha256 ~ '^[0-9a-fA-F]{64}$'),
  add constraint mrv_observations_raw_frame_binding_pair
    check ((raw_frame_artifact_version_id is null and raw_frame_sha256 is null)
        or (raw_frame_artifact_version_id is not null and raw_frame_sha256 is not null));

create or replace function guard_mrv_measurement_integrity_binding()
returns trigger language plpgsql as $$
declare
  uncertainty record;
  raw_frame record;
  activity_org uuid;
begin
  if new.mrv_instrument_id is null then
    if new.mrv_uncertainty_record_id is not null or new.raw_frame_artifact_version_id is not null then
      raise exception 'uncertainty and raw-frame evidence require an instrument-bound measurement';
    end if;
    return new;
  end if;
  select organization_id into activity_org from activities where id=new.activity_id;
  if new.mrv_uncertainty_record_id is not null then
    select * into uncertainty from mrv_instrument_parameter_uncertainty where id=new.mrv_uncertainty_record_id;
    if not found or uncertainty.instrument_id <> new.mrv_instrument_id
       or lower(uncertainty.parameter_code) <> lower(btrim(new.parameter_code))
       or uncertainty.parameter_unit <> btrim(new.unit)
       or not mrv_parameter_uncertainty_is_current(new.mrv_uncertainty_record_id) then
      raise exception 'measurement uncertainty record does not match its instrument, parameter and unit';
    end if;
  end if;
  if new.raw_frame_artifact_version_id is not null then
    select v.sha256,v.content,v.size_bytes,v.media_type,s.activity_id,s.organization_id,e.id evidence_id,e.status::text evidence_status
      into raw_frame
      from evidence_artifact_versions v
      join evidence e on e.id=v.evidence_id
      join evidence_artifact_series s on s.id=v.series_id
     where v.id=new.raw_frame_artifact_version_id;
    if not found or raw_frame.activity_id <> new.activity_id
       or raw_frame.organization_id <> activity_org
       or raw_frame.media_type <> 'application/octet-stream'
       or raw_frame.evidence_status <> 'VERIFIED'
       or not exists (select 1 from evidence_artifact_reviews r
          where r.evidence_id=raw_frame.evidence_id and r.artifact_version_id=new.raw_frame_artifact_version_id
            and r.reviewer_identity_id <> (select uploaded_by_identity_id from evidence_artifact_versions where id=new.raw_frame_artifact_version_id)
            and r.id=(select latest.id from evidence_artifact_reviews latest where latest.evidence_id=r.evidence_id and latest.artifact_version_id=r.artifact_version_id order by latest.review_sequence desc limit 1)
            and r.decision='APPROVED')
       or raw_frame.sha256 <> lower(new.raw_frame_sha256)
       or octet_length(raw_frame.content) <> raw_frame.size_bytes
       or encode(digest(raw_frame.content,'sha256'),'hex') <> raw_frame.sha256 then
      raise exception 'raw-frame artifact must be an exact server-hashed evidence version for this activity and organization';
    end if;
  end if;
  return new;
end;
$$;

create trigger measurements_integrity_binding_guard
before insert or update of activity_id,mrv_instrument_id,parameter_code,unit,mrv_uncertainty_record_id,raw_frame_artifact_version_id,raw_frame_sha256
on measurements for each row execute function guard_mrv_measurement_integrity_binding();

create or replace function guard_mrv_observation_integrity_binding()
returns trigger language plpgsql as $$
declare
  measurement record;
  uncertainty record;
  raw_frame record;
begin
  if new.measurement_id is not null then
    select m.activity_id,m.mrv_instrument_id,m.parameter_code,m.unit,m.mrv_uncertainty_record_id,
           m.raw_frame_artifact_version_id,m.raw_frame_sha256
      into measurement from measurements m where m.id=new.measurement_id;
    if not found or measurement.activity_id <> new.activity_id then
      raise exception 'MRV observation measurement binding is invalid';
    end if;
    if new.mrv_uncertainty_record_id is distinct from measurement.mrv_uncertainty_record_id
       or new.raw_frame_artifact_version_id is distinct from measurement.raw_frame_artifact_version_id
       or new.raw_frame_sha256 is distinct from measurement.raw_frame_sha256 then
      raise exception 'MRV observation must snapshot the exact measurement uncertainty and raw-frame bindings';
    end if;
  end if;
  if new.mrv_uncertainty_record_id is not null then
    select * into uncertainty from mrv_instrument_parameter_uncertainty where id=new.mrv_uncertainty_record_id;
    if not found or uncertainty.parameter_code <> new.parameter_code or uncertainty.parameter_unit <> new.unit
       or not mrv_parameter_uncertainty_is_current(new.mrv_uncertainty_record_id) then
      raise exception 'MRV observation uncertainty does not match its parameter and unit';
    end if;
  end if;
  if new.raw_frame_artifact_version_id is not null then
    select v.sha256,v.content,v.size_bytes,v.media_type,s.activity_id,e.id evidence_id,e.status::text evidence_status
      into raw_frame from evidence_artifact_versions v join evidence_artifact_series s on s.id=v.series_id join evidence e on e.id=v.evidence_id
     where v.id=new.raw_frame_artifact_version_id;
    if not found or raw_frame.activity_id <> new.activity_id
       or raw_frame.media_type <> 'application/octet-stream'
       or raw_frame.evidence_status <> 'VERIFIED'
       or not exists (select 1 from evidence_artifact_reviews r
          where r.evidence_id=raw_frame.evidence_id and r.artifact_version_id=new.raw_frame_artifact_version_id
            and r.reviewer_identity_id <> (select uploaded_by_identity_id from evidence_artifact_versions where id=new.raw_frame_artifact_version_id)
            and r.id=(select latest.id from evidence_artifact_reviews latest where latest.evidence_id=r.evidence_id and latest.artifact_version_id=r.artifact_version_id order by latest.review_sequence desc limit 1)
            and r.decision='APPROVED')
       or raw_frame.sha256 <> lower(new.raw_frame_sha256)
       or octet_length(raw_frame.content) <> raw_frame.size_bytes
       or encode(digest(raw_frame.content,'sha256'),'hex') <> raw_frame.sha256 then
      raise exception 'MRV observation raw-frame evidence hash or activity binding is invalid';
    end if;
  end if;
  return new;
end;
$$;

create trigger mrv_observations_integrity_binding_guard
before insert or update of activity_id,measurement_id,parameter_code,unit,mrv_uncertainty_record_id,raw_frame_artifact_version_id,raw_frame_sha256
on mrv_observations for each row execute function guard_mrv_observation_integrity_binding();

comment on table mrv_instrument_parameter_uncertainty is
  'Append-only per-instrument/per-parameter uncertainty records bound to the exact independently reviewed calibration artifact version. No universal acceptance threshold is implied.';
comment on column measurements.raw_frame_artifact_version_id is
  'Exact immutable evidence-vault artifact version containing raw instrument bytes; server upload path recomputes SHA-256.';
comment on column measurements.mrv_uncertainty_record_id is
  'Immutable parameter-specific uncertainty record used by this measurement.';