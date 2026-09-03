-- Explicit authorization boundaries for compliance and ESG state mutation.
-- Ordinary verified membership is not sufficient for value/compliance mutation.

create or replace function can_assess_epr(p_identity_id uuid, p_organization_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from organization_memberships om
    join roles r on r.id = om.role_id
    where om.identity_id = p_identity_id
      and om.organization_id = p_organization_id
      and om.status = 'VERIFIED'
      and (
        lower(r.name) in ('admin','administrator','org_admin','organization_admin','compliance_officer','epr_manager')
        or r.permissions @> '["ASSESS_EPR"]'::jsonb
        or r.permissions @> '["EPR_ASSESS"]'::jsonb
        or r.permissions @> '["compliance:assess"]'::jsonb
        or r.permissions @> '["compliance.assess"]'::jsonb
      )
  );
$$;

create or replace function can_write_esg(p_identity_id uuid, p_organization_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from organization_memberships om
    join roles r on r.id = om.role_id
    where om.identity_id = p_identity_id
      and om.organization_id = p_organization_id
      and om.status = 'VERIFIED'
      and (
        lower(r.name) in ('admin','administrator','org_admin','organization_admin','esg_manager','sustainability_manager')
        or r.permissions @> '["WRITE_ESG"]'::jsonb
        or r.permissions @> '["ESG_WRITE"]'::jsonb
        or r.permissions @> '["esg:write"]'::jsonb
        or r.permissions @> '["esg.write"]'::jsonb
      )
  );
$$;
