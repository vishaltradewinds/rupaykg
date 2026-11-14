-- Enforce that CPCB status history is attributed to the same organization
-- as its stakeholder workspace. Existing production data was separately
-- preflighted read-only before this migration was authored.
alter table cpcb_swm_stakeholder_workspaces
  add constraint cpcb_swm_workspace_id_org_unique
  unique (id, organization_id);

alter table cpcb_swm_status_history
  add constraint cpcb_swm_status_history_workspace_org_fk
  foreign key (workspace_id, organization_id)
  references cpcb_swm_stakeholder_workspaces(id, organization_id)
  on delete cascade
  not valid;

alter table cpcb_swm_status_history
  validate constraint cpcb_swm_status_history_workspace_org_fk;
