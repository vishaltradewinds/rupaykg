-- Link immutable Evidence Vault versions to stakeholder preparation records without changing official CPCB status.
-- Composite uniqueness lets the database enforce tenant ownership and evidence/version consistency.
alter table cpcb_swm_stakeholder_workspaces
  add constraint cpcb_swm_workspace_id_org_unique unique (id, organization_id);
alter table evidence_artifact_versions
  add constraint evidence_artifact_version_id_evidence_unique unique (id, evidence_id);

create table cpcb_swm_workspace_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  organization_id uuid not null references organizations(id),
  evidence_id uuid not null references evidence(id),
  artifact_version_id uuid not null,
  foreign key (workspace_id, organization_id)
    references cpcb_swm_stakeholder_workspaces(id, organization_id),
  foreign key (artifact_version_id, evidence_id)
    references evidence_artifact_versions(id, evidence_id),
  checklist_key text not null check (checklist_key ~ '^[a-z0-9_]{2,80}$'),
  linked_by_identity_id uuid not null references identities(id),
  created_at timestamptz not null default now(),
  unique(workspace_id, evidence_id, checklist_key)
);
create index cpcb_swm_workspace_evidence_lookup_idx on cpcb_swm_workspace_evidence(organization_id, workspace_id, created_at desc);
create index cpcb_swm_evidence_reverse_lookup_idx on cpcb_swm_workspace_evidence(organization_id, evidence_id);
create or replace function prevent_cpcb_swm_evidence_link_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'CPCB evidence links are append-only; link a new artifact version instead';
end;
$$;
create trigger cpcb_swm_workspace_evidence_immutable
before update or delete on cpcb_swm_workspace_evidence
for each row execute function prevent_cpcb_swm_evidence_link_mutation();
