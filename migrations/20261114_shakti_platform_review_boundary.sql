-- 109: Controlled cross-organization onboarding review boundary.
--
-- Applicant-facing access remains tenant-scoped under RLS. These narrowly scoped
-- SECURITY DEFINER functions are the only cross-organization review path. The
-- isolated owner is NOLOGIN/NOBYPASSRLS and cannot be assumed by the runtime.
--
-- Review authority is derived from verified memberships and geography scope:
-- PLATFORM: platform_admin/super_admin
-- STATE: state_admin/regulator within assigned geography
-- DISTRICT: regulator/state_admin within assigned geography
-- LOCAL: municipal_admin for ULB/WARD/LOCALITY, regulator otherwise
--
-- No broad table access is granted to rupaykg_app_runtime.

do $$
begin
  if not exists (select 1 from pg_roles where rolname='rupaykg_security_definer'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit) then
    raise exception 'RUPAYKG_SECURITY_DEFINER_OWNER_MISSING_OR_UNSAFE';
  end if;
end $$;

-- The isolated owner is allowed to see only the records required by the review
-- functions. These grants do not give the application runtime direct access.
grant select on public.stakeholder_applications,
  public.stakeholder_application_approvals,
  public.organization_verification_evidence,
  public.geography,
  public.roles
  to rupaykg_security_definer;

-- Grant UPDATE only on the fields mutated by the review workflow. Avoid
-- table-wide UPDATE so the isolated owner cannot alter unrelated columns.
grant update (status, reviewed_by_identity_id, reviewed_at, review_note)
  on public.stakeholder_applications to rupaykg_security_definer;
grant update (status, approved_by_identity_id, reviewed_at, review_note)
  on public.stakeholder_application_approvals to rupaykg_security_definer;
grant update (status, verification_note, verified_by_identity_id, verified_at)
  on public.organization_verification_evidence to rupaykg_security_definer;
grant update (status, verification_status, verification_note, verified_by_identity_id, verified_at)
  on public.organizations to rupaykg_security_definer;
grant update (status)
  on public.organization_memberships, public.organization_geography_scopes
  to rupaykg_security_definer;

grant select (organization_id, geography_id, status)
  on public.organization_geography_scopes to rupaykg_security_definer;

-- RLS is intentionally permissive only for the isolated function owner on the
-- review-domain tables. The owner is not a runtime member and is NOLOGIN.
do $$
begin
  drop policy if exists shakti_review_owner_read_roles on public.roles;
  create policy shakti_review_owner_read_roles
    on public.roles for select to rupaykg_security_definer using (true);

  drop policy if exists shakti_review_owner_read_applications on public.stakeholder_applications;
  create policy shakti_review_owner_read_applications
    on public.stakeholder_applications
    for select to rupaykg_security_definer using (true);

  drop policy if exists shakti_review_owner_write_applications on public.stakeholder_applications;
  create policy shakti_review_owner_write_applications
    on public.stakeholder_applications
    for update to rupaykg_security_definer using (true) with check (true);

  drop policy if exists shakti_review_owner_read_approvals on public.stakeholder_application_approvals;
  create policy shakti_review_owner_read_approvals
    on public.stakeholder_application_approvals
    for select to rupaykg_security_definer using (true);

  drop policy if exists shakti_review_owner_write_approvals on public.stakeholder_application_approvals;
  create policy shakti_review_owner_write_approvals
    on public.stakeholder_application_approvals
    for update to rupaykg_security_definer using (true) with check (true);

  drop policy if exists shakti_review_owner_read_organizations on public.organizations;
  create policy shakti_review_owner_read_organizations
    on public.organizations for select to rupaykg_security_definer using (true);
  drop policy if exists shakti_review_owner_write_organizations on public.organizations;
  create policy shakti_review_owner_write_organizations
    on public.organizations for update to rupaykg_security_definer using (true) with check (true);

  drop policy if exists shakti_review_owner_read_memberships on public.organization_memberships;
  create policy shakti_review_owner_read_memberships
    on public.organization_memberships for select to rupaykg_security_definer using (true);
  drop policy if exists shakti_review_owner_write_memberships on public.organization_memberships;
  create policy shakti_review_owner_write_memberships
    on public.organization_memberships for update to rupaykg_security_definer using (true) with check (true);

  drop policy if exists shakti_review_owner_read_geography_scopes on public.organization_geography_scopes;
  create policy shakti_review_owner_read_geography_scopes
    on public.organization_geography_scopes for select to rupaykg_security_definer using (true);
  drop policy if exists shakti_review_owner_write_geography_scopes on public.organization_geography_scopes;
  create policy shakti_review_owner_write_geography_scopes
    on public.organization_geography_scopes for update to rupaykg_security_definer using (true) with check (true);

  drop policy if exists shakti_review_owner_read_evidence on public.organization_verification_evidence;
  create policy shakti_review_owner_read_evidence
    on public.organization_verification_evidence
    for select to rupaykg_security_definer using (true);

  drop policy if exists shakti_review_owner_write_evidence on public.organization_verification_evidence;
  create policy shakti_review_owner_write_evidence
    on public.organization_verification_evidence
    for update to rupaykg_security_definer using (true) with check (true);
end $$;

grant execute on function organization_has_geography_scope(uuid,uuid)
  to rupaykg_security_definer;
grant execute on function app.current_identity_id()
  to rupaykg_security_definer;

create or replace function app.review_authority_allowed(
  p_identity_id uuid,
  p_approval_level text,
  p_geography_id uuid,
  p_geography_kind geography_kind
) returns boolean
language sql stable security definer
set search_path = pg_catalog, public, app
as $$
  select p_identity_id = app.current_identity_id() and exists (
    select 1
      from organization_memberships om
      join roles r on r.id=om.role_id
     where om.identity_id=p_identity_id
       and om.status='VERIFIED'
       and (
         (p_approval_level='PLATFORM' and r.name in ('platform_admin','super_admin'))
         or
         (p_approval_level='STATE' and r.name in ('state_admin','regulator')
           and organization_has_geography_scope(om.organization_id,p_geography_id))
         or
         (p_approval_level='DISTRICT' and r.name in ('regulator','state_admin')
           and organization_has_geography_scope(om.organization_id,p_geography_id))
         or
         (p_approval_level='LOCAL'
           and (
             (p_geography_kind in ('ULB','WARD','LOCALITY') and r.name='municipal_admin')
             or
             (p_geography_kind not in ('ULB','WARD','LOCALITY') and r.name='regulator')
           )
           and organization_has_geography_scope(om.organization_id,p_geography_id))
       )
  );
$$;

revoke all on function app.review_authority_allowed(uuid,text,uuid,geography_kind) from public;
grant execute on function app.review_authority_allowed(uuid,text,uuid,geography_kind) to rupaykg_app_runtime;

create or replace function app.onboarding_review_queue(
  p_identity_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, app
as $$
declare result jsonb;
begin
  if p_identity_id is distinct from app.current_identity_id() then
    raise exception 'ONBOARDING_REVIEW_IDENTITY_INVALID';
  end if;
  if not exists (
    select 1 from identities
     where id=p_identity_id and status='VERIFIED' and suspended_at is null
  ) then
    raise exception 'ONBOARDING_REVIEW_IDENTITY_INVALID';
  end if;

  select coalesce(jsonb_agg(
    to_jsonb(q) || jsonb_build_object(
      'nextApproval', case when q.next_approval_level is null then null
        else jsonb_build_object('approval_level',q.next_approval_level,'status',q.next_approval_status) end,
      'canReview',q.can_review,
      'canVerifyLegal',q.can_verify_legal
    ) order by q.created_at
  ), '[]'::jsonb)
    into result
    from (
      select sa.id,sa.organization_id,sa.identity_id as applicant_identity_id,
             sa.requested_role_key,sa.requested_organization_type,sa.geography_id,
             sa.status,sa.applicant_note,sa.created_at,sa.reviewed_at,sa.review_note,
             o.name organization_name,o.legal_name,o.legal_form,
             o.registration_identifier,o.registration_authority,o.verification_status,
             o.verification_note,
             (select count(*) from organization_verification_evidence e
               where e.organization_id=o.id) evidence_count,
             g.name geography_name,g.kind geography_kind,
             i.display_name applicant_name,i.email applicant_email,
             aa.approval_level next_approval_level,
             aa.status next_approval_status,
             aa.geography_id next_approval_geography_id,
             app.review_authority_allowed(
               p_identity_id,aa.approval_level,aa.geography_id,g.kind) can_review,
             (sa.requested_organization_type <> 'individual'
               and o.verification_status <> 'VERIFIED'
               and exists (
                 select 1 from organization_memberships om
                 join roles r on r.id=om.role_id
                 where om.identity_id=p_identity_id
                   and om.status='VERIFIED'
                   and r.name in ('platform_admin','super_admin')
               )) can_verify_legal
        from stakeholder_applications sa
        join organizations o on o.id=sa.organization_id
        left join geography g on g.id=sa.geography_id
        left join identities i on i.id=sa.identity_id
        left join lateral (
          select a.approval_level,a.status,a.geography_id
            from stakeholder_application_approvals a
           where a.application_id=sa.id and a.status='PENDING'
           order by a.step_order limit 1
        ) aa on true
       where sa.status='PENDING'
         and (
           app.review_authority_allowed(p_identity_id,aa.approval_level,aa.geography_id,g.kind)
           or (
             sa.requested_organization_type <> 'individual'
             and o.verification_status <> 'VERIFIED'
             and exists (
               select 1 from organization_memberships om
               join roles r on r.id=om.role_id
               where om.identity_id=p_identity_id
                 and om.status='VERIFIED'
                 and r.name in ('platform_admin','super_admin')
             )
           )
         )
    ) q;

  return result;
end;
$$;

revoke all on function app.onboarding_review_queue(uuid) from public;
grant execute on function app.onboarding_review_queue(uuid) to rupaykg_app_runtime;

create or replace function app.onboarding_verify_legal(
  p_identity_id uuid,
  p_application_id uuid,
  p_status text,
  p_note text
) returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, public, app
as $$
declare oid uuid; evidence_count integer;
begin
  if p_identity_id is distinct from app.current_identity_id() then
    raise exception 'ONBOARDING_REVIEW_IDENTITY_INVALID';
  end if;
  if p_status not in ('VERIFIED','REJECTED') or p_note is null or btrim(p_note)='' then
    raise exception 'LEGAL_REVIEW_INVALID';
  end if;

  if not exists (
    select 1 from identities
     where id=p_identity_id and status='VERIFIED' and suspended_at is null
  ) then
    raise exception 'ONBOARDING_REVIEW_IDENTITY_INVALID';
  end if;

  if not exists (
    select 1 from organization_memberships om
    join roles r on r.id=om.role_id
    where om.identity_id=p_identity_id
      and om.status='VERIFIED'
      and r.name in ('platform_admin','super_admin')
  ) then
    raise exception 'ONBOARDING_AUTHORITY_FORBIDDEN';
  end if;

  select organization_id into oid
    from stakeholder_applications
   where id=p_application_id and status='PENDING'
   for update;

  if oid is null then raise exception 'APPLICATION_NOT_FOUND'; end if;

  if p_status='VERIFIED' then
    select count(*) into evidence_count
      from organization_verification_evidence
     where organization_id=oid
       and document_reference is not null and btrim(document_reference)<>''
       and content_hash is not null and btrim(content_hash)<>'';
    if evidence_count < 1 then raise exception 'LEGAL_EVIDENCE_MISSING'; end if;
  end if;

  update organization_verification_evidence
     set status=p_status,verification_note=p_note,
         verified_by_identity_id=p_identity_id,verified_at=now()
   where organization_id=oid and status in ('PENDING','REJECTED');

  update organizations
     set verification_status=p_status,
         verification_note=p_note,
         verified_by_identity_id=case when p_status='VERIFIED' then p_identity_id else null end,
         verified_at=case when p_status='VERIFIED' then now() else null end
   where id=oid;

  return jsonb_build_object('source','postgresql','syntheticData',false,
    'status',p_status,'organizationId',oid);
end;
$$;

revoke all on function app.onboarding_verify_legal(uuid,uuid,text,text) from public;
grant execute on function app.onboarding_verify_legal(uuid,uuid,text,text) to rupaykg_app_runtime;

create or replace function app.onboarding_decide(
  p_identity_id uuid,
  p_application_id uuid,
  p_action text,
  p_note text
) returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, public, app
as $$
declare appn record; next_step record; remaining integer;
begin
  if p_identity_id is distinct from app.current_identity_id() then
    raise exception 'ONBOARDING_REVIEW_IDENTITY_INVALID';
  end if;
  if p_action not in ('approve','reject') then raise exception 'INVALID_DECISION'; end if;
  if p_action='reject' and (p_note is null or btrim(p_note)='') then raise exception 'REVIEW_NOTE_REQUIRED'; end if;

  if not exists (
    select 1 from identities
     where id=p_identity_id and status='VERIFIED' and suspended_at is null
  ) then raise exception 'ONBOARDING_REVIEW_IDENTITY_INVALID';
  end if;

  select sa.*,g.kind geography_kind,o.verification_status
    into appn
    from stakeholder_applications sa
    left join geography g on g.id=sa.geography_id
    join organizations o on o.id=sa.organization_id
   where sa.id=p_application_id and sa.status='PENDING'
   for update;

  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;

  select * into next_step
    from stakeholder_application_approvals
   where application_id=p_application_id and status='PENDING'
   order by step_order limit 1
   for update;

  if not found then raise exception 'APPROVAL_CHAIN_COMPLETE'; end if;

  if not app.review_authority_allowed(p_identity_id,next_step.approval_level,next_step.geography_id,appn.geography_kind)
    then raise exception 'ONBOARDING_AUTHORITY_FORBIDDEN'; end if;

  if next_step.approval_level='PLATFORM'
     and p_action='approve'
     and appn.requested_organization_type<>'individual'
     and appn.verification_status<>'VERIFIED'
    then raise exception 'LEGAL_VERIFICATION_REQUIRED'; end if;

  if p_action='reject' then
    update stakeholder_application_approvals
       set status='REJECTED',approved_by_identity_id=p_identity_id,
           reviewed_at=now(),review_note=p_note where id=next_step.id;
    update stakeholder_applications
       set status='REJECTED',reviewed_by_identity_id=p_identity_id,
           reviewed_at=now(),review_note=p_note where id=p_application_id;
    update organization_memberships set status='REJECTED'
      where organization_id=appn.organization_id and identity_id=appn.identity_id and status='PENDING';
    update organization_geography_scopes set status='REJECTED'
      where organization_id=appn.organization_id and status='PENDING';
    update organizations set status='REJECTED',
      verification_status=case when verification_status='VERIFIED' then verification_status else 'REJECTED' end,
      verification_note=coalesce(verification_note,p_note)
      where id=appn.organization_id;
    return jsonb_build_object('source','postgresql','syntheticData',false,
      'status','REJECTED','approvalLevel',next_step.approval_level);
  end if;

  update stakeholder_application_approvals
     set status='APPROVED',approved_by_identity_id=p_identity_id,
         reviewed_at=now(),review_note=p_note
   where id=next_step.id;

  select count(*) into remaining
    from stakeholder_application_approvals
   where application_id=p_application_id and status<>'APPROVED';

  if remaining=0 then
    update stakeholder_applications set status='APPROVED',
      reviewed_by_identity_id=p_identity_id,reviewed_at=now(),review_note=p_note
      where id=p_application_id;
    update organizations set status='VERIFIED',verification_status='VERIFIED',
      verified_by_identity_id=p_identity_id,verified_at=now()
      where id=appn.organization_id;
    update organization_memberships set status='VERIFIED'
      where organization_id=appn.organization_id and identity_id=appn.identity_id and status='PENDING';
    update organization_geography_scopes set status='VERIFIED'
      where organization_id=appn.organization_id and status='PENDING';
  end if;

  return jsonb_build_object('source','postgresql','syntheticData',false,
    'status',case when remaining=0 then 'APPROVED' else 'PENDING' end,
    'approvalLevel',next_step.approval_level);
end;
$$;

revoke all on function app.onboarding_decide(uuid,uuid,text,text) from public;
grant execute on function app.onboarding_decide(uuid,uuid,text,text) to rupaykg_app_runtime;

comment on function app.onboarding_review_queue(uuid) is
'Narrow cross-organization onboarding review read boundary. Runtime can execute only; isolated SECURITY DEFINER owner performs authorization and RLS-protected reads.';
comment on function app.onboarding_verify_legal(uuid,uuid,text,text) is
'Narrow platform legal-verification write boundary. Requires verified platform authority and persisted evidence.';
comment on function app.onboarding_decide(uuid,uuid,text,text) is
'Narrow hierarchical onboarding decision boundary. Enforces approval level and geography authority before cross-organization mutation.';

-- All review SECURITY DEFINER entry points and their authorization helper
-- execute as the isolated NOLOGIN/NOBYPASSRLS owner, never the DDL runner.
alter function app.review_authority_allowed(uuid,text,uuid,geography_kind)
  owner to rupaykg_security_definer;
alter function app.onboarding_review_queue(uuid)
  owner to rupaykg_security_definer;
alter function app.onboarding_verify_legal(uuid,uuid,text,text)
  owner to rupaykg_security_definer;
alter function app.onboarding_decide(uuid,uuid,text,text)
  owner to rupaykg_security_definer;
