-- A stakeholder application must not request a role owned by another organization.
-- Composite FK prevents mismatched organization/role pairs at the database boundary.
alter table roles
  add constraint roles_id_organization_unique unique (id, organization_id);

alter table stakeholder_applications
  add constraint stakeholder_applications_role_organization_fk
  foreign key (role_id, organization_id)
  references roles(id, organization_id)
  not valid;

alter table stakeholder_applications
  validate constraint stakeholder_applications_role_organization_fk;
