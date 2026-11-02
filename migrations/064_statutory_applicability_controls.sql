-- Versioned statutory applicability controls.
-- These records classify applicability for platform workflows; they do not
-- constitute CPCB/State/PCC registration, certificates, filings, approvals,
-- SEBI acceptance, assurance, or any other external statutory determination.

create table if not exists organization_statutory_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  framework text not null,
  rule_reference text not null,
  effective_from date,
  effective_to date,
  applicability_status text not null default 'UNKNOWN'
    check (applicability_status in ('UNKNOWN','POTENTIALLY_APPLICABLE','APPLICABLE','NOT_APPLICABLE','UNDER_REVIEW')),
  basis jsonb not null default '{}',
  determination_note text,
  externally_confirmed boolean not null default false,
  external_authority text,
  external_reference text,
  determined_by_identity_id uuid references identities(id),
  determined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, framework, rule_reference, effective_from)
);

create index if not exists organization_statutory_profiles_org_idx
  on organization_statutory_profiles(organization_id, framework, applicability_status);

-- SWM Rules 2026 Bulk Waste Generator thresholds. The platform stores the
-- measurements used to assess applicability and never treats a computed match
-- as an external registration or approval.
create table if not exists organization_bwg_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  assessment_date date not null default current_date,
  floor_area_sq_m numeric(20,3) check (floor_area_sq_m is null or floor_area_sq_m >= 0),
  water_consumption_lpd numeric(20,3) check (water_consumption_lpd is null or water_consumption_lpd >= 0),
  solid_waste_kgpd numeric(20,3) check (solid_waste_kgpd is null or solid_waste_kgpd >= 0),
  floor_area_threshold_sq_m numeric(20,3) not null default 20000,
  water_threshold_lpd numeric(20,3) not null default 40000,
  waste_threshold_kgpd numeric(20,3) not null default 100,
  threshold_basis text not null default 'SWM_RULES_2026_S_O_388_E',
  applicability_status text not null default 'UNKNOWN'
    check (applicability_status in ('UNKNOWN','POTENTIALLY_APPLICABLE','APPLICABLE','NOT_APPLICABLE','UNDER_REVIEW')),
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  determination_note text,
  determined_by_identity_id uuid references identities(id),
  determined_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organization_bwg_assessments_org_date_idx
  on organization_bwg_assessments(organization_id, assessment_date desc);

-- EPR applicability is scheme-specific because the CPCB portals and rules
-- differ by waste stream. A row records preparation/assessment state only.
create table if not exists organization_epr_applicability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  scheme text not null,
  rule_reference text,
  applicability_status text not null default 'UNKNOWN'
    check (applicability_status in ('UNKNOWN','POTENTIALLY_APPLICABLE','APPLICABLE','NOT_APPLICABLE','UNDER_REVIEW')),
  basis jsonb not null default '{}',
  cpcb_registration_status text not null default 'NOT_ASSERTED'
    check (cpcb_registration_status in ('NOT_ASSERTED','PREPARED','SUBMITTED_EXTERNALLY','REGISTERED_EXTERNALLY','REJECTED_EXTERNALLY','EXPIRED_EXTERNALLY')),
  cpcb_registration_reference text,
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  determination_note text,
  determined_by_identity_id uuid references identities(id),
  determined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, scheme)
);

create index if not exists organization_epr_applicability_org_idx
  on organization_epr_applicability(organization_id, scheme, applicability_status);

-- Seed the current platform rule catalogue. These are rule references, not
-- claims that every organization is subject to every framework.
insert into organization_statutory_profiles
  (organization_id, framework, rule_reference, applicability_status, basis)
select o.id, 'SWM_BWG', 'SWM_RULES_2026_S_O_388_E', 'UNKNOWN',
       jsonb_build_object('effectiveFrom', '2026-04-01', 'thresholds', jsonb_build_object(
         'floorAreaSqM', 20000,
         'waterConsumptionLpd', 40000,
         'solidWasteKgpd', 100
       ))
from organizations o
where not exists (
  select 1 from organization_statutory_profiles p
  where p.organization_id=o.id and p.framework='SWM_BWG'
    and p.rule_reference='SWM_RULES_2026_S_O_388_E' and p.effective_from is null
);
