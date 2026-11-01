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

create role rupaykg_auth_runtime nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- Existing trigger functions must remain safe when invoked inside a SECURITY DEFINER
-- function with search_path restricted to pg_catalog, pg_temp.
create or replace function public.ensure_organization_governance_profile()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  insert into public.organization_statutory_profiles
    (organization_id, framework, rule_reference, effective_from, applicability_status, basis)
  values
    (new.id, 'SWM_BWG', 'SWM_RULES_2026_S_O_388_E', date '2026-04-01', 'UNKNOWN',
     jsonb_build_object('source', 'RupayKG governance catalogue', 'externalAcceptance', false,
       'thresholds', jsonb_build_object('floorAreaSqM', 20000,
         'waterConsumptionLpd', 40000, 'solidWasteKgpd', 100)))
  on conflict (organization_id, framework, rule_reference, effective_from) do nothing;
  return new;
end;
$$;

create or replace function public.rupaykg_seed_stakeholder_approval_chain()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare gk public.geography_kind; levels text[]; level_name text; idx integer := 1;
begin
  select g.kind into gk from public.geography g where g.id=new.geography_id;
  levels := case
    when gk in ('ULB','WARD','LOCALITY','GRAM_PANCHAYAT','VILLAGE','CLUSTER') then array['LOCAL','DISTRICT','STATE','PLATFORM']
    when gk in ('SUB_DISTRICT','DISTRICT') then array['DISTRICT','STATE','PLATFORM']
    when gk='STATE_UT' then array['STATE','PLATFORM']
    else array['PLATFORM']
  end;
  foreach level_name in array levels loop
    insert into public.stakeholder_application_approvals(application_id,step_order,approval_level,geography_id)
    values(new.id,idx,level_name,new.geography_id) on conflict do nothing;
    idx := idx+1;
  end loop;
  return new;
end;
$$;

create or replace function public.prevent_incomplete_hierarchical_stakeholder_approval()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.status = 'APPROVED' and old.status is distinct from 'APPROVED'
     and exists (select 1 from public.stakeholder_application_approvals a where a.application_id=new.id and a.status<>'APPROVED') then
    raise exception 'STAKEHOLDER_HIERARCHY_INCOMPLETE: all required approval levels must be approved before application activation';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_direct_membership_activation()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $
declare
  role_name text;
  dual_control_approved boolean := false;
  access_request_type text;
  target_membership_id uuid;
  previous_revoked_at timestamptz;
begin
  if new.status <> 'VERIFIED' then
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if old.status = 'VERIFIED' then
      return new;
    end if;
    target_membership_id := old.id;
    previous_revoked_at := old.last_revoked_at;
  end if;

  select r.name into role_name
    from public.roles r
   where r.id = new.role_id and r.organization_id = new.organization_id;

  -- Reserved platform roles retain the original two-person database guard.
  if role_name in ('super_admin','platform_admin') then
    access_request_type := case when TG_OP = 'INSERT' then 'GRANT_RESERVED_ROLE' else 'RESTORE_RESERVED_ROLE' end;

    select exists (
      select 1
        from public.platform_access_change_requests q
        join public.identities requester on requester.id=q.requester_identity_id
        join public.identities approver on approver.id=q.approver_identity_id
       where q.request_type=access_request_type
         and q.target_identity_id=new.identity_id
         and q.organization_id=new.organization_id
         and q.role_id=new.role_id
         and (
           (TG_OP = 'INSERT' and q.membership_id is null)
           or
           (TG_OP = 'UPDATE' and q.membership_id=target_membership_id
             and previous_revoked_at is not null
             and q.created_at > previous_revoked_at)
         )
         and q.status='APPROVED'
         and q.applied_at is not null
         and q.requester_identity_id <> q.approver_identity_id
         and q.requester_identity_id <> q.target_identity_id
         and q.approver_identity_id <> q.target_identity_id
         and requester.status='VERIFIED' and requester.suspended_at is null
         and approver.status='VERIFIED' and approver.suspended_at is null
         and exists (
           select 1 from public.organization_memberships om
           join public.roles r on r.id=om.role_id
           join public.organizations o on o.id=om.organization_id and o.status='VERIFIED'
           where om.identity_id=q.requester_identity_id and om.organization_id=q.organization_id and om.status='VERIFIED'
             and r.name='super_admin'
             and exists (select 1 from jsonb_array_elements_text(r.permissions) as permission(value) where permission.value='admin:users')
         )
         and exists (
           select 1 from public.organization_memberships om
           join public.roles r on r.id=om.role_id
           join public.organizations o on o.id=om.organization_id and o.status='VERIFIED'
           where om.identity_id=q.approver_identity_id and om.organization_id=q.organization_id and om.status='VERIFIED'
             and r.name='super_admin'
             and exists (select 1 from jsonb_array_elements_text(r.permissions) as permission(value) where permission.value='admin:users')
         )
    ) into dual_control_approved;

    if not dual_control_approved then
      raise exception 'RESERVED_ROLE_REQUIRES_DUAL_CONTROL';
    end if;
    return new;
  end if;

  -- Ordinary memberships require a completed stakeholder application on both
  -- INSERT and status promotion. Test fixtures must use the governed lifecycle.
  if not exists (
    select 1 from public.stakeholder_applications sa
     where sa.identity_id=new.identity_id
       and sa.organization_id=new.organization_id
       and sa.role_id=new.role_id
       and sa.status='APPROVED'
  ) then
    raise exception 'STAKEHOLDER_MEMBERSHIP_REQUIRES_APPROVED_APPLICATION';
  end if;
  return new;
end;
$;

create or replace function public.prevent_unauthorized_stakeholder_approval()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $
begin
  -- An application must always enter through PENDING intake. Direct INSERT as
  -- APPROVED would otherwise bypass the UPDATE-only authority and hierarchy gates.
  if TG_OP = 'INSERT' then
    if new.status = 'APPROVED' then
      raise exception 'STAKEHOLDER_APPLICATION_MUST_START_PENDING';
    end if;
    return new;
  end if;

  if new.status = 'APPROVED' and old.status is distinct from 'APPROVED' then
    if new.reviewed_by_identity_id is null then
      raise exception 'Stakeholder approval requires a reviewing platform authority';
    end if;
    if new.reviewed_by_identity_id = new.identity_id then
      raise exception 'Stakeholder applications cannot be self-approved';
    end if;
    if not exists (
      select 1
      from public.organization_memberships om
      join public.roles r on r.id = om.role_id
      where om.identity_id = new.reviewed_by_identity_id
        and om.status = 'VERIFIED'
        and r.name in ('platform_admin', 'super_admin')
    ) then
      raise exception 'Stakeholder approval requires a verified platform_admin or super_admin';
    end if;
  end if;
  return new;
end;
$;

drop trigger if exists stakeholder_approval_authority_guard on public.stakeholder_applications;
create trigger stakeholder_approval_authority_guard
before insert or update of status, reviewed_by_identity_id
on public.stakeholder_applications
for each row execute function public.prevent_unauthorized_stakeholder_approval();

create or replace function public.prevent_stakeholder_self_approval()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $
begin
  if new.approved_by_identity_id is not null and exists (
    select 1 from public.stakeholder_applications sa
    where sa.id=new.application_id and sa.identity_id=new.approved_by_identity_id
  ) then
    raise exception 'STAKEHOLDER_SELF_APPROVAL_FORBIDDEN';
  end if;
  return new;
end;
$$;

-- Existing policy catalogue is retained; only its lookup is schema-qualified.
alter function public.rupaykg_default_role_permissions(text) set search_path = pg_catalog, pg_temp;

create or replace function public.apply_rupaykg_role_defaults()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare defaults jsonb;
begin
  if new.permissions is null or jsonb_typeof(new.permissions) <> 'array' then
    new.permissions := '[]'::jsonb;
  end if;
  defaults := public.rupaykg_default_role_permissions(new.name);
  if jsonb_array_length(new.permissions)=0 and jsonb_array_length(defaults)>0 then
    new.permissions := defaults;
  end if;
  return new;
end;
$$;

-- Table grants are issued by the migration principal while it still has the
-- necessary table-owner/grant-option authority.
grant select on public.identities, public.identity_sessions, public.geography,
  public.stakeholder_applications to rupaykg_auth_owner;
grant insert on public.organization_statutory_profiles to rupaykg_auth_owner;
grant select, insert on public.organizations, public.roles, public.organization_memberships,
  public.organization_geography_scopes, public.organization_verification_evidence,
  public.stakeholder_applications, public.stakeholder_application_approvals to rupaykg_auth_owner;
grant update on public.identity_sessions, public.organizations, public.organization_memberships,
  public.organization_geography_scopes, public.stakeholder_applications to rupaykg_auth_owner;
grant usage on schema public to rupaykg_auth_owner;
grant references on public.identities, public.organizations, public.roles, public.geography, public.stakeholder_applications to rupaykg_auth_owner;
grant select on public.platform_access_change_requests to rupaykg_auth_owner;

-- Create the function schema with the migration principal's database CREATE
-- authority; the function owner does not need CREATE on the database itself.
grant rupaykg_auth_owner to current_user;
create schema if not exists auth_private authorization rupaykg_auth_owner;
alter schema auth_private owner to rupaykg_auth_owner;
revoke all on schema auth_private from public;
grant usage on schema auth_private to rupaykg_auth_runtime;

-- Execute the SECURITY DEFINER DDL as its dedicated NOLOGIN owner.
set role rupaykg_auth_owner;

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

  perform pg_advisory_xact_lock(hashtextextended(p_token_hash, 0));
  select s.identity_id into v_identity_id
  from public.identity_sessions s
  join public.identities i on i.id=s.identity_id
  where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at>now()
    and i.status='VERIFIED'::public.record_status and i.suspended_at is null
;

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
  perform pg_advisory_xact_lock(hashtextextended(p_token_hash, 0));
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

create or replace function auth_private.revoke_session(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare v_count integer;
begin
  if p_token_hash is null or length(p_token_hash)<>64 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_token_hash, 0));
  update public.identity_sessions
     set revoked_at=coalesce(revoked_at,now())
   where token_hash=p_token_hash and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count=1;
end;
$$;

revoke all on function auth_private.create_stakeholder_application(text,text,text,text,text,text,text,uuid,text,text,text,text,text,timestamptz,timestamptz) from public;
revoke all on function auth_private.withdraw_stakeholder_application(text,uuid) from public;
revoke all on function auth_private.revoke_session(text) from public;
grant execute on function auth_private.create_stakeholder_application(text,text,text,text,text,text,text,uuid,text,text,text,text,text,timestamptz,timestamptz) to rupaykg_auth_runtime;
grant execute on function auth_private.withdraw_stakeholder_application(text,uuid) to rupaykg_auth_runtime;
grant execute on function auth_private.revoke_session(text) to rupaykg_auth_runtime;
reset role;
