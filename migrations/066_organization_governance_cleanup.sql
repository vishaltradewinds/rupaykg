-- Preserve existing organization cleanup semantics after additive governance tables.
-- Governance records are organization-owned and must be removed with the organization
-- in the same way other tenant-owned records are cleaned up by integration tests and
-- controlled lifecycle operations. This does not grant or remove operational access.

alter table organization_statutory_profiles
  drop constraint if exists organization_statutory_profiles_organization_id_fkey;
alter table organization_statutory_profiles
  add constraint organization_statutory_profiles_organization_id_fkey
  foreign key (organization_id) references organizations(id) on delete cascade;

alter table organization_bwg_assessments
  drop constraint if exists organization_bwg_assessments_organization_id_fkey;
alter table organization_bwg_assessments
  add constraint organization_bwg_assessments_organization_id_fkey
  foreign key (organization_id) references organizations(id) on delete cascade;

alter table organization_epr_applicability
  drop constraint if exists organization_epr_applicability_organization_id_fkey;
alter table organization_epr_applicability
  drop constraint if exists organization_epr_applicability_organization_id_fkey1;
alter table organization_epr_applicability
  add constraint organization_epr_applicability_organization_id_fkey
  foreign key (organization_id) references organizations(id) on delete cascade;

alter table organization_verification_evidence
  drop constraint if exists organization_verification_evidence_organization_id_fkey;
alter table organization_verification_evidence
  add constraint organization_verification_evidence_organization_id_fkey
  foreign key (organization_id) references organizations(id) on delete cascade;
