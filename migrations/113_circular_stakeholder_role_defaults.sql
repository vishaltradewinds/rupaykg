-- Extend least-privilege onboarding defaults for the connected circular-economy
-- stakeholder chain. Existing role permissions are preserved unless empty.
create or replace function rupaykg_default_role_permissions(role_name text)
returns jsonb
language sql
immutable
as $$
  select case role_name
    when 'citizen' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'farmer' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'safai_mitra' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'fpo' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","swm:read","reports:export"]'::jsonb
    when 'municipal_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","evidence:upload","evidence:review","VERIFY_EVIDENCE","swm:read","swm:manage","projects:read","registry:read","credits:read","epr:read","audit:read"]'::jsonb
    when 'ulb_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","evidence:upload","evidence:review","swm:read","swm:manage"]'::jsonb
    when 'gram_panchayat_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","swm:read"]'::jsonb
    when 'panchayat_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","swm:read"]'::jsonb
    when 'municipal_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","swm:read"]'::jsonb
    when 'state_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","evidence:review","VERIFY_EVIDENCE","swm:read","swm:manage","projects:read","projects:review","registry:read","credits:read","epr:read","csr:read","audit:read","audit:execute","admin:users","MANAGE_STAKEHOLDERS"]'::jsonb
    when 'aggregator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'processor' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'recycler' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'transporter' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'collector_transporter' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'bwg' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","swm:read"]'::jsonb
    when 'bulk_waste_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","swm:read"]'::jsonb
    when 'industry_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","epr:read"]'::jsonb
    when 'commercial_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","epr:read"]'::jsonb
    when 'institution_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","epr:read"]'::jsonb
    when 'PROJECT_OWNER' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","evidence:upload","projects:read","projects:create","projects:manage","registry:read","credits:read"]'::jsonb
    when 'ACVA_USER' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","evidence:review","VERIFY_EVIDENCE","projects:read","projects:review","projects:verify","registry:read","credits:read","audit:read","audit:execute"]'::jsonb
    when 'ccc_buyer' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","projects:read","registry:read","credits:read","credits:buy","credits:retire","RETIRE_CREDENTIAL"]'::jsonb
    when 'regulator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","evidence:review","VERIFY_EVIDENCE","swm:read","swm:manage","projects:read","projects:review","projects:verify","registry:read","credits:read","epr:read","epr:manage","csr:read","csr:manage","guardian:read","guardian:operate","audit:read","audit:execute"]'::jsonb
    when 'epr_partner' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","registry:read","credits:read","epr:read","epr:manage"]'::jsonb
    when 'csr_partner' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","registry:read","credits:read","csr:read","csr:manage"]'::jsonb
    when 'super_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","evidence:review","VERIFY_EVIDENCE","swm:read","swm:manage","projects:read","projects:create","projects:manage","projects:review","projects:verify","acva:manage","registry:read","registry:write","ISSUE_CREDENTIAL","TRANSFER_CREDENTIAL","RETIRE_CREDENTIAL","credits:read","credits:issue","credits:buy","credits:retire","credits:transfer","epr:read","epr:manage","csr:read","csr:manage","guardian:read","guardian:operate","audit:read","audit:execute","admin:users","admin:roles","admin:security","admin:system","MANAGE_STAKEHOLDERS"]'::jsonb
    when 'VERIFIER' then '["dashboard:read","profile:read","reports:read","evidence:review","VERIFY_EVIDENCE"]'::jsonb
    when 'AUDITOR' then '["dashboard:read","profile:read","reports:read","evidence:review","VERIFY_EVIDENCE","audit:read","audit:execute"]'::jsonb
    else '[]'::jsonb
  end;
$$;
