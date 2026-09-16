-- Hierarchical stakeholder onboarding.
create table if not exists stakeholder_application_approvals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references stakeholder_applications(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  approval_level text not null check (approval_level in ('LOCAL','DISTRICT','STATE','PLATFORM')),
  geography_id uuid references geography(id),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  approved_by_identity_id uuid references identities(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  unique(application_id, step_order),
  unique(application_id, approval_level)
);
create index if not exists stakeholder_application_approvals_queue_idx on stakeholder_application_approvals(status, approval_level, step_order);
create index if not exists stakeholder_application_approvals_application_idx on stakeholder_application_approvals(application_id, step_order);

create or replace function prevent_incomplete_hierarchical_stakeholder_approval()
returns trigger language plpgsql as $$
begin
  if new.status = 'APPROVED' and old.status is distinct from 'APPROVED'
     and exists (select 1 from stakeholder_application_approvals a where a.application_id = new.id and a.status <> 'APPROVED') then
    raise exception 'STAKEHOLDER_HIERARCHY_INCOMPLETE: all required approval levels must be approved before application activation';
  end if;
  return new;
end;
$$;
drop trigger if exists stakeholder_hierarchy_completion_guard on stakeholder_applications;
create trigger stakeholder_hierarchy_completion_guard before update of status on stakeholder_applications for each row execute function prevent_incomplete_hierarchical_stakeholder_approval();

create or replace function prevent_direct_membership_activation()
returns trigger language plpgsql as $$
begin
  if new.status = 'VERIFIED' and old.status is distinct from 'VERIFIED' and not exists (
    select 1 from stakeholder_applications sa where sa.identity_id = new.identity_id and sa.organization_id = new.organization_id and sa.role_id = new.role_id and sa.status = 'APPROVED'
  ) then
    raise exception 'STAKEHOLDER_MEMBERSHIP_REQUIRES_APPROVED_APPLICATION';
  end if;
  return new;
end;
$$;
drop trigger if exists stakeholder_membership_application_guard on organization_memberships;
create trigger stakeholder_membership_application_guard before update of status on organization_memberships for each row execute function prevent_direct_membership_activation();
