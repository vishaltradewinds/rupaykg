-- Governed organization/legal verification evidence.
-- This is additive: operational access remains controlled by organization/membership
-- status and platform review; evidence here does not itself grant access or imply
-- statutory approval, CPCB registration, SEBI acceptance, or other external authority.

alter table organizations
  add column if not exists legal_name text,
  add column if not exists legal_form text,
  add column if not exists registration_identifier text,
  add column if not exists registration_authority text,
  add column if not exists verification_status text not null default 'PENDING'
    check (verification_status in ('PENDING','UNDER_REVIEW','VERIFIED','REJECTED')),
  add column if not exists verification_note text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by_identity_id uuid references identities(id);

create table if not exists organization_verification_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  evidence_type text not null,
  document_reference text,
  content_hash text,
  issuer_name text,
  issued_at timestamptz,
  expires_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING','VERIFIED','REJECTED','EXPIRED')),
  verification_note text,
  verified_by_identity_id uuid references identities(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organization_verification_evidence_org_idx
  on organization_verification_evidence(organization_id, status);

create index if not exists organizations_verification_status_idx
  on organizations(verification_status);
