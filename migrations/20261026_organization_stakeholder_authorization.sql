-- Explicit, reviewed organization-to-stakeholder authorization.
-- No organization is automatically mapped. A VERIFIED row requires an external
-- evidence-backed review; this is platform authorization, not CPCB registration.
create table if not exists organization_stakeholder_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  stakeholder_type text not null check (stakeholder_type in (
    'BWG','WASTE_FACILITY','ULB','DISTRICT_PANCHAYAT','GRAM_PANCHAYAT',
    'COLLECTOR_TRANSPORTER','PROCESSOR'
  )),
  status text not null default 'PENDING' check (status in ('PENDING','VERIFIED','REVOKED')),
  evidence_reference text not null,
  evidence_sha256 text check (evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$'),
  verification_note text,
  verified_by_identity_id uuid references identities(id),
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stakeholder_type),
  check (
    (status = 'VERIFIED' and verified_by_identity_id is not null and verified_at is not null)
    or status <> 'VERIFIED'
  )
);
create index if not exists organization_stakeholder_authorizations_lookup_idx
  on organization_stakeholder_authorizations(organization_id, stakeholder_type, status);
