-- Model-specific hardware approval and calibration gate for MRV instruments.
-- Field-device identity verification is deliberately separate from physical instrument approval.

create table mrv_instruments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  instrument_code text not null,
  instrument_type text not null,
  manufacturer text not null,
  model text not null,
  sku_revision text not null,
  intended_use text not null,
  measurement_instrument boolean not null default true,
  non_measurement_reason text,
  supported_parameter_codes text[] not null default '{}'::text[] check (array_position(supported_parameter_codes, NULL::text) is null and array_position(supported_parameter_codes, '') is null),
  interface_protocol text,
  firmware_version text,
  firmware_support_until timestamptz,
  security_review_status text not null default 'PENDING' check (security_review_status in ('PENDING','VERIFIED','NOT_APPLICABLE_WITH_JUSTIFICATION')),
  security_evidence_reference text,
  security_evidence_sha256 text check (security_evidence_sha256 is null or security_evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  security_reviewed_at timestamptz,
  security_not_applicable_reason text,
  meity_certificate_id text,
  meity_issuer text,
  meity_certificate_scope text,
  meity_verification_url text,
  meity_evidence_reference text,
  meity_evidence_sha256 text check (meity_evidence_sha256 is null or meity_evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  meity_verified_at timestamptz,
  meity_validity_basis text check (meity_validity_basis in ('VALID_UNTIL','NO_EXPIRY_CONFIRMED')),
  meity_valid_until timestamptz,
  calibration_required boolean not null default true,
  calibration_status text not null default 'PENDING'
    check (calibration_status in ('PENDING','VERIFIED','EXPIRED','NOT_APPLICABLE_WITH_JUSTIFICATION')),
  calibration_certificate_id text,
  calibration_evidence_reference text,
  calibration_evidence_sha256 text check (calibration_evidence_sha256 is null or calibration_evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  calibration_lab text,
  calibration_traceability text,
  calibration_uncertainty numeric(20,8) check (calibration_uncertainty is null or calibration_uncertainty >= 0),
  calibration_valid_until timestamptz,
  calibration_not_required_reason text,
  approval_status text not null default 'HOLD'
    check (approval_status in ('HOLD','VERIFIED','EXPIRED','REJECTED')),
  evidence_bundle_hash text,
  metadata jsonb not null default '{}',
  registered_by_identity_id uuid not null references identities(id),
  registered_at timestamptz not null default now(),
  reviewed_by_identity_id uuid references identities(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, instrument_code),
  check (btrim(instrument_code) <> ''),
  check (btrim(instrument_type) <> ''),
  check (btrim(manufacturer) <> ''),
  check (btrim(model) <> ''),
  check (btrim(sku_revision) <> ''),
  check (btrim(intended_use) <> '')
);

create table mrv_instrument_decisions (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references mrv_instruments(id),
  organization_id uuid not null references organizations(id),
  prior_status text,
  new_status text not null check (new_status in ('HOLD','VERIFIED','EXPIRED','REJECTED')),
  reviewer_identity_id uuid not null references identities(id),
  decision_note text not null,
  evidence_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index mrv_instruments_org_status_idx
  on mrv_instruments(organization_id, approval_status, instrument_code);
create index mrv_instrument_decisions_instrument_idx
  on mrv_instrument_decisions(instrument_id, created_at desc);

create or replace function guard_mrv_instrument_approval()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.approval_status <> 'HOLD' then
      raise exception 'new MRV instruments must start in HOLD pending model-specific review';
    end if;
    return new;
  end if;

  if (old.approval_status = 'VERIFIED' or exists (
    select 1 from mrv_instrument_decisions d where d.instrument_id = old.id and d.new_status = 'VERIFIED'
  )) and (
    new.organization_id is distinct from old.organization_id
    or new.registered_by_identity_id is distinct from old.registered_by_identity_id
    or new.registered_at is distinct from old.registered_at
    or new.instrument_code is distinct from old.instrument_code
    or new.instrument_type is distinct from old.instrument_type
    or new.manufacturer is distinct from old.manufacturer
    or new.model is distinct from old.model
    or new.sku_revision is distinct from old.sku_revision
    or new.intended_use is distinct from old.intended_use
    or new.measurement_instrument is distinct from old.measurement_instrument
    or new.non_measurement_reason is distinct from old.non_measurement_reason
    or new.supported_parameter_codes is distinct from old.supported_parameter_codes
    or new.metadata is distinct from old.metadata
    or new.evidence_bundle_hash is distinct from old.evidence_bundle_hash
    or new.interface_protocol is distinct from old.interface_protocol
    or new.firmware_version is distinct from old.firmware_version
    or new.firmware_support_until is distinct from old.firmware_support_until
    or new.security_review_status is distinct from old.security_review_status
    or new.security_evidence_reference is distinct from old.security_evidence_reference
    or new.security_evidence_sha256 is distinct from old.security_evidence_sha256
    or new.security_reviewed_at is distinct from old.security_reviewed_at
    or new.security_not_applicable_reason is distinct from old.security_not_applicable_reason
    or new.meity_certificate_id is distinct from old.meity_certificate_id
    or new.meity_issuer is distinct from old.meity_issuer
    or new.meity_certificate_scope is distinct from old.meity_certificate_scope
    or new.meity_verification_url is distinct from old.meity_verification_url
    or new.meity_evidence_reference is distinct from old.meity_evidence_reference
    or new.meity_evidence_sha256 is distinct from old.meity_evidence_sha256
    or new.meity_verified_at is distinct from old.meity_verified_at
    or new.meity_validity_basis is distinct from old.meity_validity_basis
    or new.meity_valid_until is distinct from old.meity_valid_until
    or new.calibration_required is distinct from old.calibration_required
    or new.calibration_status is distinct from old.calibration_status
    or new.calibration_certificate_id is distinct from old.calibration_certificate_id
    or new.calibration_evidence_reference is distinct from old.calibration_evidence_reference
    or new.calibration_evidence_sha256 is distinct from old.calibration_evidence_sha256
    or new.calibration_lab is distinct from old.calibration_lab
    or new.calibration_traceability is distinct from old.calibration_traceability
    or new.calibration_uncertainty is distinct from old.calibration_uncertainty
    or new.calibration_valid_until is distinct from old.calibration_valid_until
    or new.calibration_not_required_reason is distinct from old.calibration_not_required_reason
  ) then
    raise exception 'verified MRV instrument identity and approval evidence are immutable; register a new instrument record';
  end if;

  if (old.approval_status = 'VERIFIED' or exists (
      select 1 from mrv_instrument_decisions d where d.instrument_id = old.id and d.new_status = 'VERIFIED'
    ))
     and new.approval_status is not distinct from old.approval_status
     and (new.reviewed_by_identity_id is distinct from old.reviewed_by_identity_id
       or new.reviewed_at is distinct from old.reviewed_at
       or new.review_note is distinct from old.review_note) then
    raise exception 'reviewer provenance can only change as part of an explicit status decision';
  end if;

  if new.approval_status = 'VERIFIED'
     and new.registered_by_identity_id = new.reviewed_by_identity_id then
    raise exception 'MRV instrument approval requires a reviewer distinct from the registrant';
  end if;

  if new.approval_status is distinct from old.approval_status then
    if new.reviewed_by_identity_id is null or new.reviewed_at is null or nullif(btrim(new.review_note), '') is null then
      raise exception 'MRV instrument status change requires reviewer, timestamp and reason';
    end if;
  end if;

  if new.approval_status = 'VERIFIED' then
    if nullif(btrim(new.meity_certificate_id), '') is null
       or nullif(btrim(new.meity_issuer), '') is null
       or nullif(btrim(new.meity_certificate_scope), '') is null
       or coalesce(new.meity_verification_url, '') !~ '^https://'
       or nullif(btrim(new.meity_evidence_reference), '') is null
       or coalesce(new.meity_evidence_sha256, '') !~ '^[0-9a-fA-F]{64}$'
       or new.meity_verified_at is null
       or new.meity_verified_at > now()
       or new.meity_validity_basis is null then
      raise exception 'VERIFIED MRV instrument requires exact-model MeitY approval evidence and official verification URL';
    end if;
    if new.firmware_version is not null then
      if new.firmware_support_until is null or new.firmware_support_until <= now()
         or new.security_review_status <> 'VERIFIED'
         or nullif(btrim(new.security_evidence_reference), '') is null
         or coalesce(new.security_evidence_sha256, '') !~ '^[0-9a-fA-F]{64}$'
         or new.security_reviewed_at is null or new.security_reviewed_at > now() then
        raise exception 'Firmware-enabled instrument requires current support and reviewed security lifecycle evidence';
      end if;
    elsif new.firmware_support_until is not null
       or new.security_review_status <> 'NOT_APPLICABLE_WITH_JUSTIFICATION'
       or nullif(btrim(new.security_not_applicable_reason), '') is null then
      raise exception 'Instrument without firmware requires a written security-lifecycle not-applicable rationale';
    end if;
    if new.meity_validity_basis = 'VALID_UNTIL'
       and (new.meity_valid_until is null or new.meity_valid_until <= now()) then
      raise exception 'MeitY approval validity must be current';
    end if;
    if new.meity_validity_basis = 'NO_EXPIRY_CONFIRMED' and new.meity_valid_until is not null then
      raise exception 'no-expiry approval must not specify an expiry date';
    end if;
    if new.measurement_instrument and cardinality(new.supported_parameter_codes) = 0 then
      raise exception 'Measuring instrument requires explicitly reviewed supported parameter codes';
    elsif not new.measurement_instrument and (nullif(btrim(new.non_measurement_reason), '') is null or cardinality(new.supported_parameter_codes) > 0) then
      raise exception 'Non-measuring hardware requires a written reason and cannot declare physical measurement parameters';
    end if;
    if exists (select 1 from unnest(new.supported_parameter_codes) as parameter_code where btrim(parameter_code) = '') then
      raise exception 'Supported parameter codes cannot contain blank values';
    end if;
    if new.calibration_required then
      if new.calibration_status <> 'VERIFIED'
         or nullif(btrim(new.calibration_certificate_id), '') is null
         or nullif(btrim(new.calibration_evidence_reference), '') is null
         or coalesce(new.calibration_evidence_sha256, '') !~ '^[0-9a-fA-F]{64}$'
         or nullif(btrim(new.calibration_lab), '') is null
         or nullif(btrim(new.calibration_traceability), '') is null
         or new.calibration_uncertainty is null
         or new.calibration_valid_until is null
         or new.calibration_valid_until <= now() then
        raise exception 'VERIFIED measuring instrument requires current traceable calibration evidence';
      end if;
    elsif new.calibration_status <> 'NOT_APPLICABLE_WITH_JUSTIFICATION'
       or nullif(btrim(new.calibration_not_required_reason), '') is null then
      raise exception 'non-measuring instrument requires a written calibration-not-required rationale';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger mrv_instrument_approval_guard
before insert or update on mrv_instruments
for each row execute function guard_mrv_instrument_approval();

create or replace function record_mrv_instrument_decision()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into mrv_instrument_decisions(
      instrument_id, organization_id, prior_status, new_status,
      reviewer_identity_id, decision_note, evidence_snapshot
    ) values (
      new.id, new.organization_id, null, new.approval_status,
      new.registered_by_identity_id, 'Candidate registered; pending exact-model review',
      jsonb_build_object('instrumentCode', new.instrument_code, 'manufacturer', new.manufacturer,
        'model', new.model, 'skuRevision', new.sku_revision, 'measurementInstrument', new.measurement_instrument, 'nonMeasurementReason', new.non_measurement_reason, 'supportedParameterCodes', new.supported_parameter_codes)
    );
  elsif new.approval_status is distinct from old.approval_status then
    insert into mrv_instrument_decisions(
      instrument_id, organization_id, prior_status, new_status,
      reviewer_identity_id, decision_note, evidence_snapshot
    ) values (
      new.id, new.organization_id, old.approval_status, new.approval_status,
      new.reviewed_by_identity_id, new.review_note,
      jsonb_build_object('instrumentCode', new.instrument_code, 'manufacturer', new.manufacturer,
        'model', new.model, 'skuRevision', new.sku_revision,
        'measurementInstrument', new.measurement_instrument,
        'nonMeasurementReason', new.non_measurement_reason,
        'supportedParameterCodes', new.supported_parameter_codes,
        'meityCertificateId', new.meity_certificate_id,
        'meityIssuer', new.meity_issuer,
        'meityCertificateScope', new.meity_certificate_scope,
        'meityVerifiedAt', new.meity_verified_at,
        'interfaceProtocol', new.interface_protocol,
        'meityEvidenceReference', new.meity_evidence_reference,
        'meityEvidenceSha256', new.meity_evidence_sha256,
        'meityVerificationUrl', new.meity_verification_url,
        'meityValidityBasis', new.meity_validity_basis,
        'meityValidUntil', new.meity_valid_until,
        'calibrationRequired', new.calibration_required,
        'calibrationStatus', new.calibration_status,
        'calibrationCertificateId', new.calibration_certificate_id,
        'calibrationEvidenceReference', new.calibration_evidence_reference,
        'calibrationEvidenceSha256', new.calibration_evidence_sha256,
        'calibrationLab', new.calibration_lab,
        'calibrationTraceability', new.calibration_traceability,
        'calibrationUncertainty', new.calibration_uncertainty,
        'calibrationValidUntil', new.calibration_valid_until,
        'calibrationNotRequiredReason', new.calibration_not_required_reason,
        'firmwareVersion', new.firmware_version,
        'firmwareSupportUntil', new.firmware_support_until,
        'securityReviewStatus', new.security_review_status,
        'securityEvidenceReference', new.security_evidence_reference,
        'securityEvidenceSha256', new.security_evidence_sha256,
        'securityReviewedAt', new.security_reviewed_at,
        'securityNotApplicableReason', new.security_not_applicable_reason)
    );
  end if;
  return new;
end;
$$;

create trigger mrv_instrument_decision_insert
after insert on mrv_instruments
for each row execute function record_mrv_instrument_decision();

create trigger mrv_instrument_decision_status_update
after update of approval_status on mrv_instruments
for each row execute function record_mrv_instrument_decision();

create or replace function prevent_mrv_instrument_decision_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'MRV instrument decision history is append-only';
end;
$$;

-- Only the instrument lifecycle trigger may append decision rows. The nested
-- insert runs at trigger depth >= 2; ordinary application SQL runs at depth 1.
create or replace function require_mrv_instrument_decision_trigger_context()
returns trigger language plpgsql as $decision_guard$
begin
  if pg_trigger_depth() < 2 then
    raise exception 'MRV instrument decisions must be recorded by the instrument lifecycle trigger';
  end if;
  return new;
end;
$decision_guard$;

create trigger mrv_instrument_decisions_guard_insert
before insert on mrv_instrument_decisions
for each row execute function require_mrv_instrument_decision_trigger_context();

create trigger mrv_instrument_decisions_append_only
before update or delete on mrv_instrument_decisions
for each row execute function prevent_mrv_instrument_decision_mutation();

create trigger mrv_instrument_decisions_no_truncate
before truncate on mrv_instrument_decisions
for each statement execute function prevent_mrv_instrument_decision_mutation();
