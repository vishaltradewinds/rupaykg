-- Add separate local preparation stage and explicitly user-reported CPCB status.
-- This is not a CPCB integration and does not verify any portal status.
alter table cpcb_swm_stakeholder_workspaces
  add column local_workflow_stage text not null default 'LOCAL_PREPARATION'
    check (local_workflow_stage in (
      'LOCAL_PREPARATION',
      'ELIGIBILITY_REVIEW',
      'DOCUMENTS_PENDING',
      'READY_FOR_USER_SUBMISSION',
      'SUBMISSION_REPORTED',
      'UNDER_REVIEW_FOLLOW_UP',
      'CORRECTION_PREPARATION',
      'AMENDMENT_PREPARATION',
      'LEVEL_1_APPEAL_PREPARATION',
      'GRIEVANCE_PREPARATION',
      'EVENT_INTIMATION_PREPARATION',
      'CLOSED_LOCAL',
      'UNRESOLVED'
    )),
  add column cpcb_reported_status text not null default 'NOT_REPORTED'
    check (cpcb_reported_status in (
      'NOT_REPORTED',
      'DRAFT',
      'UNDER_REVIEW',
      'CORRECTION_REQUESTED',
      'APPROVED',
      'REJECTED'
    ));

create table cpcb_swm_status_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references cpcb_swm_stakeholder_workspaces(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  previous_reported_status text not null check (previous_reported_status in ('NOT_REPORTED','DRAFT','UNDER_REVIEW','CORRECTION_REQUESTED','APPROVED','REJECTED')),
  reported_status text not null check (reported_status in ('NOT_REPORTED','DRAFT','UNDER_REVIEW','CORRECTION_REQUESTED','APPROVED','REJECTED')),
  source_reference text,
  status_note text,
  actor_identity_id uuid not null references identities(id),
  recorded_at timestamptz not null default now()
);
create index cpcb_swm_status_history_workspace_idx on cpcb_swm_status_history(workspace_id, recorded_at desc);
create index cpcb_swm_status_history_org_idx on cpcb_swm_status_history(organization_id, recorded_at desc);
