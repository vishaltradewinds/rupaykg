-- Auth-scoped stakeholder onboarding mutations.
-- Functions accept only a token hash; the authenticated identity is derived inside PostgreSQL.
-- No RLS is enabled here. Full tenant-policy rollout remains a separate release gate.

do $$
begin
  if not exists (select 1 from pg_roles where rolname='rupaykg_auth_owner') then
    create role rupaykg_auth_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  else
    alter role rupaykg_auth_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

create schema if not exists auth_private authorization rupaykg_auth_owner;
alter schema auth_private owner to rupaykg_auth_owner;
revoke all on schema auth_private from public;
grant usage on schema auth_private to public;

grant select on public.identities, public.identity_sessions, public.geography to rupaykg_auth_owner;
grant select, insert on public.organizations, public.roles, public.organization_memberships,
  public.organization_geography_scopes, public.organization_verification_evidence,
  public.stakeholder_applications, public.stakeholder_application_approvals to rupaykg_auth_owner;
grant update on public.organizations, public.organization_memberships,
  public.organization_geography_scopes, public.stakeholder_applications to rupaykg_auth_owner;

create or replace function auth_private.create_stakeholder_application(
  p_token_hash text,
  p_organization_name text,
  p_role_key text,
  p_legal_name text default null,
  p_legal_form text default null,
  p_registration_identifier text default null,
  p_registration_authority text default null,
  p_geography_id uuid default null,
  p_applicant_note text default null,
  p_evidence_type text default null,
  p_document_reference text default null,
  p_content_hash text default null,
  p_issuer_name text default null,
  p_issued_at timestamptz default null,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_identity_id uuid;
  v_org_type text;
  v_permissions jsonb;
  v_org_id uuid;
  v_role_id uuid;
  v_application jsonb;
  v_requires_legal boolean;
begin
  if p_token_hash is null or length(p_token_hash) <> 64 or p_organization_name is null or length(btrim(p_organization_name)) not between 1 and 200 then
    raise exception 'INVALID_ONBOARDING_INPUT' using errcode='22023';
  end if;

  select s.identity_id into v_identity_id
  from public.identity_sessions s
  join public.identities i on i.id=s.identity_id
  where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at>now()
    and i.status='VERIFIED'::public.record_status and i.suspended_at is null
  for share of s, i;

  if v_identity_id is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;

  v_org_type := case p_role_key
    when 'citizen' then 'individual'
    when 'farmer' then 'rural_enterprise'
    when 'safai_mitra' then 'collection_operator'
    when 'fpo' then 'rural_institution'
    when 'municipal_admin' then 'ulb'
    when 'municipal_generator' then 'bulk_generator'
    when 'aggregator' then 'logistics'
    when 'processor' then 'processing_facility'
    when 'industry_generator' then 'industrial_generator'
    when 'commercial_generator' then 'commercial_generator'
    when 'institution_generator' then 'institutional_generator'
    when 'PROJECT_OWNER' then 'carbon_project'
    when 'ACVA_USER' then 'acva'
    when 'ccc_buyer' then 'buyer'
    when 'epr_partner' then 'epr'
    when 'csr_partner' then 'csr'
    when 'regulator' then 'regulator'
    else null
  end;
  if v_org_type is null then
    raise exception 'UNSUPPORTED_STAKEHOLDER_ROLE' using errcode='22023';
  end if;

  v_requires_legal := v_org_type <> 'individual';
  if v_requires_legal and (
    nullif(btrim(coalesce(p_legal_name,p_organization_name)),'') is null
    or nullif(btrim(p_legal_form),'') is null
    or nullif(btrim(p_registration_identifier),'') is null
    or nullif(btrim(p_registration_authority),'') is null
    or nullif(btrim(p_evidence_type),'') is null
    or nullif(btrim(p_document_reference),'') is null
    or nullif(btrim(p_content_hash),'') is null
  ) then
    raise exception 'LEGAL_IDENTITY_AND_EVIDENCE_REQUIRED' using errcode='22023';
  end if;
  if p_geography_id is not null and not exists(select 1 from public.geography g where g.id=p_geography_id) then
    raise exception 'GEOGRAPHY_NOT_FOUND' using errcode='22023';
  end if;
  if exists(select 1 from public.stakeholder_applications sa where sa.identity_id=v_identity_id and sa.status in ('PENDING','APPROVED')) then
    raise exception 'APPLICATION_EXISTS' using errcode='23505';
  end if;

  v_permissions := case p_role_key
    when 'citizen' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'farmer' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'safai_mitra' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'fpo' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","swm:read","reports:export"]'::jsonb
    when 'municipal_admin' then '["dashboard:read","profile:read","reports:read","profile:update","waste:read","evidence:upload","evidence:review","reports:export","swm:read","swm:manage","projects:read","registry:read","credits:read","epr:read","audit:read"]'::jsonb
    when 'municipal_generator' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","swm:read","reports:export"]'::jsonb
    when 'aggregator' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","reports:export"]'::jsonb
    when 'processor' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","reports:export"]'::jsonb
    when 'industry_generator' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","reports:export","epr:read"]'::jsonb
    when 'commercial_generator' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","reports:export","epr:read"]'::jsonb
    when 'institution_generator' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","reports:export","epr:read"]'::jsonb
    when 'PROJECT_OWNER' then '["dashboard:read","profile:read","reports:read","profile:update","waste:read","evidence:upload","reports:export","projects:read","projects:create","projects:manage","registry:read","credits:read"]'::jsonb
    when 'ACVA_USER' then '["dashboard:read","profile:read","reports:read","profile:update","evidence:review","reports:export","projects:read","projects:review","projects:verify","registry:read","credits:read","audit:read","audit:execute","VERIFY_EVIDENCE","verification:approve","verification.approve"]'::jsonb
    when 'ccc_buyer' then '["dashboard:read","profile:read","reports:read","profile:update","reports:export","projects:read","registry:read","credits:read","credits:buy","credits:retire"]'::jsonb
    when 'epr_partner' then '["dashboard:read","profile:read","reports:read","profile:update","waste:read","reports:export","epr:read","epr:manage","registry:read","credits:read"]'::jsonb
    when 'csr_partner' then '["dashboard:read","profile:read","reports:read","profile:update","reports:export","csr:read","csr:manage","registry:read","credits:read"]'::jsonb
    when 'regulator' then '["dashboard:read","profile:read","reports:read","profile:update","waste:read","evidence:review","reports:export","swm:read","swm:manage","projects:read","projects:review","projects:verify","acva:manage","registry:read","credits:read","epr:read","epr:manage","csr:read","csr:manage","guardian:read","guardian:operate","audit:read","audit:execute","VERIFY_EVIDENCE","verification:approve","verification.approve"]'::jsonb
    else '[]'::jsonb
  end;

  insert into public.organizations(name,organization_type,legal_name,legal_form,registration_identifier,registration_authority,status,verification_status)
  values(btrim(p_organization_name),v_org_type,coalesce(nullif(btrim(p_legal_name),''),btrim(p_organization_name)),p_legal_form,p_registration_identifier,p_registration_authority,'PENDING'::public.record_status,'UNDER_REVIEW')
  returning id into v_org_id;

  insert into public.roles(organization_id,name,permissions,geography_scope)
  values(v_org_id,p_role_key,v_permissions,'[]'::jsonb) returning id into v_role_id;

  insert into public.organization_memberships(identity_id,organization_id,role_id,status)
  values(v_identity_id,v_org_id,v_role_id,'PENDING'::public.record_status);

  if p_geography_id is not null then
    insert into public.organization_geography_scopes(organization_id,geography_id,status)
    values(v_org_id,p_geography_id,'PENDING'::public.record_status);
  end if;

  if p_evidence_type is not null and p_document_reference is not null and p_content_hash is not null then
    insert into public.organization_verification_evidence(organization_id,evidence_type,document_reference,content_hash,issuer_name,issued_at,expires_at,status)
    values(v_org_id,p_evidence_type,p_document_reference,p_content_hash,p_issuer_name,p_issued_at,p_expires_at,'PENDING');
  end if;

  insert into public.stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id,status,applicant_note)
  values(v_identity_id,v_org_id,v_role_id,p_role_key,v_org_type,p_geography_id,'PENDING',p_applicant_note)
  returning to_jsonb(stakeholder_applications.*) into v_application;

  return jsonb_build_object('application',v_application,'organization_id',v_org_id,'role_id',v_role_id,'identity_id',v_identity_id);
end;
$$;

create or replace function auth_private.withdraw_stakeholder_application(p_token_hash text,p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare v_identity_id uuid; v_organization_id uuid;
begin
  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  select s.identity_id into v_identity_id
  from public.identity_sessions s
  join public.identities i on i.id=s.identity_id
  where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at>now()
    and i.status='VERIFIED'::public.record_status and i.suspended_at is null
  for share of s, i;
  if v_identity_id is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  update public.stakeholder_applications
  set status='WITHDRAWN',reviewed_at=now(),review_note='Withdrawn by applicant'
  where id=p_application_id and identity_id=v_identity_id and status='PENDING'
  returning organization_id into v_organization_id;
  if v_organization_id is null then return jsonb_build_object('status','NOT_FOUND'); end if;

  update public.organization_memberships
  set status='REJECTED'::public.record_status,
      last_revoked_at=now(),last_revoked_by_identity_id=v_identity_id,
      last_revocation_reason='Applicant withdrew stakeholder application'
  where organization_id=v_organization_id and identity_id=v_identity_id and status='PENDING'::public.record_status;

  update public.organization_geography_scopes set status='REJECTED'::public.record_status
  where organization_id=v_organization_id and status='PENDING'::public.record_status;

  update public.organizations
  set status='REJECTED'::public.record_status,verification_status='REJECTED',
      verification_note='Application withdrawn by applicant'
  where id=v_organization_id and status='PENDING'::public.record_status;

  return jsonb_build_object('status','WITHDRAWN','organization_id',v_organization_id);
end;
$$;

alter function auth_private.create_stakeholder_application(text,text,text,text,text,text,text,uuid,text,text,text,text,text,timestamptz,timestamptz) owner to rupaykg_auth_owner;
alter function auth_private.withdraw_stakeholder_application(text,uuid) owner to rupaykg_auth_owner;
revoke all on all functions in schema auth_private from public;
grant execute on function auth_private.create_stakeholder_application(text,text,text,text,text,text,text,uuid,text,text,text,text,text,timestamptz,timestamptz) to rupaykg_auth_runtime;
grant execute on function auth_private.withdraw_stakeholder_application(text,uuid) to rupaykg_auth_runtime;
