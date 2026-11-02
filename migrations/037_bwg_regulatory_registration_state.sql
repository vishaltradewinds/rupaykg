-- Track the authoritative external registration state required for Bulk Waste Generators.
-- This is a provenance/state field only: RupayKG must never infer CPCB acceptance.
alter table bwg_profiles
  add column if not exists regulatory_registration_status text not null default 'NOT_REGISTERED'
    check (regulatory_registration_status in ('NOT_REGISTERED','READY','SUBMITTED','ACCEPTED','REJECTED','UNKNOWN')),
  add column if not exists regulatory_registration_reference text;

comment on column bwg_profiles.regulatory_registration_status is
  'Authoritative external BWG registration state. RupayKG records state only and never synthesizes external acceptance.';
comment on column bwg_profiles.regulatory_registration_reference is
  'External registration/reference identifier when actually supplied by the authoritative registration system.';
