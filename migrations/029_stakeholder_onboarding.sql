-- Stakeholder onboarding state is separate from identity authentication.
-- Authentication proves who the person is; this table records which platform role/org
-- they requested and whether the platform has approved that relationship.

create table stakeholder_applications (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id),
  organization_id uuid not null references organizations(id),
  role_id uuid not null references roles(id),
  requested_role_key text not null,
  requested_organization_type text not null,
  geography_id uuid references geography(id),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  applicant_note text,
  reviewed_by_identity_id uuid references identities(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(identity_id, organization_id, role_id)
);

create index stakeholder_applications_identity_idx on stakeholder_applications(identity_id, status);
create index stakeholder_applications_review_idx on stakeholder_applications(status, created_at);

alter table organizations add column if not exists external_reference text;
alter table identities add column if not exists email text;

create unique index if not exists organizations_external_reference_unique_idx
  on organizations(external_reference)
  where external_reference is not null and btrim(external_reference) <> '';

create index if not exists identities_email_idx on identities(lower(email)) where email is not null;
