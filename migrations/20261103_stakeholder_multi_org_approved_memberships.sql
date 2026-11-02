-- A verified identity may hold memberships in multiple organizations.
-- Only PENDING applications are mutually exclusive per identity; APPROVED
-- applications remain durable evidence and must not block later onboarding.
begin;

drop index if exists public.stakeholder_applications_one_active_per_identity_idx;

create unique index stakeholder_applications_one_active_per_identity_idx
  on public.stakeholder_applications(identity_id)
  where status = 'PENDING';

comment on index public.stakeholder_applications_one_active_per_identity_idx is
  'At most one pending onboarding application per identity; approved applications are retained as evidence and permit additional organization memberships.';

commit;
