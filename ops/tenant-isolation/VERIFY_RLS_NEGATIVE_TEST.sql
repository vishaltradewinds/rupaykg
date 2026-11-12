-- Shakti tenant-isolation post-RLS negative acceptance test.
-- Run only after ACTIVATE_RLS.sql succeeds, using the deployment operator that
-- can SET ROLE to the intended non-BYPASSRLS runtime role.
--
-- The test is transactional and rolls back all fixtures. It proves both
-- visibility and mutation isolation for two independent organizations.
-- Connect with a dedicated LOGIN role that is NOBYPASSRLS and has SET ROLE
-- membership to both rupaykg_ddl and rupaykg_app_runtime. This script switches
-- to rupaykg_ddl for rollback-only fixture setup, then to the runtime role for
-- tenant assertions. The postgres superuser is accepted only for disposable CI.

begin;

select 1 / case
  when pg_has_role(session_user, 'rupaykg_app_runtime', 'member') then 1
  else 0
end as runtime_role_membership_assertion;

set local role rupaykg_app_runtime;
select 1 / case
  when current_user = 'rupaykg_app_runtime' then 1
  else 0
end as runtime_role_switch_assertion;

reset role;

-- The connection login must be a restricted, non-BYPASSRLS DDL operator with
-- SET ROLE rights to both controlled roles. Disposable CI runs as postgres.
select 1 / case
  when session_user = 'postgres' then 1
  when exists (
    select 1 from pg_roles
     where rolname = session_user
       and rolcanlogin
       and not rolsuper
       and not rolbypassrls
  )
   and pg_has_role(session_user, 'rupaykg_ddl', 'member')
   and pg_has_role(session_user, 'rupaykg_app_runtime', 'member')
  then 1
  else 0
end as controlled_ddl_login_assertion;

set local role rupaykg_ddl;
select 1 / case
  when current_user = 'rupaykg_ddl'
   and not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user)
  then 1 else 0
end as controlled_ddl_role_assertion;

do $shakti$
declare
  v_missing text[] := array[]::text[];
  v_name text;
begin
  foreach v_name in array array[
    'organizations','roles','organization_memberships','activities',
    'obligations','credentials','settlements','audit_events','resource_flows',
    'field_devices','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links','mrv_provenance_events'
  ] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_name and c.relrowsecurity
    ) then
      v_missing := array_append(v_missing, v_name);
    end if;
  end loop;
  if cardinality(v_missing) > 0 then
    raise exception 'RLS_NEGATIVE_TEST_BLOCKED: RLS is not enabled on %', array_to_string(v_missing, ', ');
  end if;
end $shakti$;

do $shakti$
declare
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_org_a uuid;
  v_org_b uuid;
  v_identity_a uuid;
  v_identity_b uuid;
  v_role_a uuid;
  v_role_b uuid;
  v_activity_a uuid := gen_random_uuid();
  v_activity_b uuid := gen_random_uuid();
  v_evidence_a uuid := gen_random_uuid();
  v_evidence_a_mismatch uuid := gen_random_uuid();
  v_evidence_b uuid := gen_random_uuid();
  v_verification_a uuid := gen_random_uuid();
  v_verification_b uuid := gen_random_uuid();
  v_provenance_a uuid := gen_random_uuid();
  v_provenance_b uuid := gen_random_uuid();
  v_insert_blocked boolean := false;
  v_name text;
  v_visible integer;
  v_affected integer;
begin
  select id into v_org_a
    from organizations
   where false;
  v_org_a := gen_random_uuid();
  v_org_b := gen_random_uuid();
  v_identity_a := gen_random_uuid();
  v_identity_b := gen_random_uuid();
  v_role_a := gen_random_uuid();
  v_role_b := gen_random_uuid();

  -- This onboarding trigger writes a statutory profile through an
  -- invoker-security function owned by rupaykg. The disposable RLS fixture
  -- does not test statutory-profile seeding, so suppress only this trigger
  -- while inserting fixture organizations; the surrounding transaction
  -- guarantees the trigger state is rolled back after the test.
  if exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.organizations'::regclass
       and t.tgname = 'trg_seed_organization_governance_profile'
       and not t.tgisinternal
  ) then
    alter table organizations disable trigger trg_seed_organization_governance_profile;
  end if;

  insert into organizations(id,name,organization_type,status)
  values
    (v_org_a, 'SHakti-RLS-A-'||v_suffix, 'test_fixture', 'VERIFIED'),
    (v_org_b, 'SHakti-RLS-B-'||v_suffix, 'test_fixture', 'VERIFIED');

  if exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.organizations'::regclass
       and t.tgname = 'trg_seed_organization_governance_profile'
       and not t.tgisinternal
  ) then
    alter table organizations enable trigger trg_seed_organization_governance_profile;
  end if;

  insert into identities(id,external_subject,display_name,email,status)
  values
    (v_identity_a,'shakti-rls-a:'||v_suffix,'Shakti RLS A','shakti-rls-a-'||v_suffix||'@example.invalid','VERIFIED'),
    (v_identity_b,'shakti-rls-b:'||v_suffix,'Shakti RLS B','shakti-rls-b-'||v_suffix||'@example.invalid','VERIFIED');

  insert into roles(id,organization_id,name,permissions,geography_scope)
  values
    (v_role_a,v_org_a,'shakti_rls_test_role_a','["dashboard:read","VERIFY_EVIDENCE","verification:approve"]'::jsonb,'[]'::jsonb),
    (v_role_b,v_org_b,'shakti_rls_test_role_b','["dashboard:read","VERIFY_EVIDENCE","verification:approve"]'::jsonb,'[]'::jsonb);

  if exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.organization_memberships'::regclass
       and t.tgname = 'stakeholder_membership_application_guard'
       and not t.tgisinternal
  ) then
    alter table organization_memberships disable trigger stakeholder_membership_application_guard;
  end if;

  insert into organization_memberships(identity_id,organization_id,role_id,status)
  values
    (v_identity_a,v_org_a,v_role_a,'VERIFIED'),
    (v_identity_b,v_org_b,v_role_b,'VERIFIED');

  if exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.organization_memberships'::regclass
       and t.tgname = 'stakeholder_membership_application_guard'
       and not t.tgisinternal
  ) then
    alter table organization_memberships enable trigger stakeholder_membership_application_guard;
  end if;

  insert into activities(id,organization_id,activity_type,status)
  values
    (v_activity_a,v_org_a,'RLS_MRV_FIXTURE','COMPLETED'),
    (v_activity_b,v_org_b,'RLS_MRV_FIXTURE','COMPLETED');

  insert into evidence(id,activity_id,evidence_type,status,captured_at,content_uri,content_hash)
  values
    (v_evidence_a,v_activity_a,'RLS_MRV_FIXTURE','VERIFIED',clock_timestamp(),'fixture://mrv-a','fixture-hash-a'),
    (v_evidence_a_mismatch,v_activity_a,'RLS_MRV_FIXTURE','VERIFIED',clock_timestamp(),'fixture://mrv-a-mismatch','fixture-hash-a-mismatch'),
    (v_evidence_b,v_activity_b,'RLS_MRV_FIXTURE','VERIFIED',clock_timestamp(),'fixture://mrv-b','fixture-hash-b');

  insert into verifications(id,evidence_id,activity_id,verifier_identity_id,decision,scope)
  values
    (v_verification_a,v_evidence_a,v_activity_a,v_identity_a,'APPROVED','RLS_MRV_FIXTURE'),
    (v_verification_b,v_evidence_b,v_activity_b,v_identity_b,'APPROVED','RLS_MRV_FIXTURE');

  insert into mrv_provenance_events(id,activity_id,verification_id,evidence_id,guardian_policy_id,guardian_status,hcs_status,integrity_hash,metadata)
  values
    (v_provenance_a,v_activity_a,v_verification_a,v_evidence_a,'test-policy-a','UNAVAILABLE','NOT_CONFIGURED','test-mrv-a-'||v_suffix,'{"fixture":"rollback-only"}'::jsonb),
    (v_provenance_b,v_activity_b,v_verification_b,v_evidence_b,'test-policy-b','UNAVAILABLE','NOT_CONFIGURED','test-mrv-b-'||v_suffix,'{"fixture":"rollback-only"}'::jsonb);

  execute 'set local role rupaykg_app_runtime';

  perform app.set_request_context(v_identity_a,v_org_a);

  select count(*) into v_visible from organizations where id=v_org_a;
  if v_visible <> 1 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: organization A not visible to tenant A';
  end if;

  select count(*) into v_visible from organizations where id=v_org_b;
  if v_visible <> 0 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant A can read organization B';
  end if;

  update organizations set name=name where id=v_org_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant A mutated organization B';
  end if;

  delete from organizations where id=v_org_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant A deleted organization B';
  end if;

  select count(*) into v_visible from mrv_provenance_events where id=v_provenance_a;
  if v_visible <> 1 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant A cannot read its MRV provenance';
  end if;

  select count(*) into v_visible from mrv_provenance_events where id=v_provenance_b;
  if v_visible <> 0 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant A can read tenant B MRV provenance';
  end if;

  update mrv_provenance_events set metadata=metadata where id=v_provenance_b;
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant A mutated tenant B MRV provenance';
  end if;

  begin
    insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_status,hcs_status,integrity_hash,metadata)
    values(v_activity_b,v_verification_b,v_evidence_b,'cross-tenant-test','UNAVAILABLE','NOT_CONFIGURED','blocked-mrv-'||v_suffix,'{"fixture":"rollback-only"}'::jsonb);
  exception when insufficient_privilege then
    v_insert_blocked := true;
  end;
  if not v_insert_blocked then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant A inserted tenant B MRV provenance';
  end if;

  -- Same-tenant evidence/verification IDs must still refer to the same evidence.
  -- Both rows belong to activity A, so this catches a binding gap rather than
  -- merely repeating the cross-tenant isolation assertion.
  v_insert_blocked := false;
  begin
    -- Keep this JSON literal unescaped: PostgreSQL standard_conforming_strings is ON.
    insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_status,hcs_status,integrity_hash,metadata)
    values(v_activity_a,v_verification_a,v_evidence_a_mismatch,'same-tenant-mismatch-test','UNAVAILABLE','NOT_CONFIGURED','blocked-mismatch-'||v_suffix,'{"fixture":"rollback-only"}'::jsonb);
  exception when insufficient_privilege then
    v_insert_blocked := true;
  end;
  if not v_insert_blocked then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: provenance accepted a verification bound to different evidence in the same activity';
  end if;

  perform app.set_request_context(v_identity_b,v_org_b);
  select count(*) into v_visible from mrv_provenance_events where id=v_provenance_b;
  if v_visible <> 1 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant B cannot read its MRV provenance';
  end if;
  select count(*) into v_visible from mrv_provenance_events where id=v_provenance_a;
  if v_visible <> 0 then
    raise exception 'RLS_NEGATIVE_TEST_FAILED: tenant B can read tenant A MRV provenance';
  end if;

  reset role;

  -- Fail-closed check: with no tenant context, the runtime must see zero
  -- rows from every protected tenant table. This prevents accidental
  -- context omission from becoming cross-tenant visibility.
  execute 'set local role rupaykg_app_runtime';
  perform set_config('app.identity_id', '', true);
  perform set_config('app.organization_id', '', true);

  foreach v_name in array array[
    'organizations','roles','activities','obligations','credentials',
    'settlements','audit_events','resource_flows','field_devices',
    'organization_memberships','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links','mrv_provenance_events'
  ] loop
    execute format('select count(*) from public.%I', v_name) into v_visible;
    if v_visible <> 0 then
      raise exception 'RLS_NEGATIVE_TEST_FAILED: no-context runtime can see % rows from protected table %', v_visible, v_name;
    end if;
  end loop;

  reset role;

  raise notice 'RLS_NEGATIVE_TEST_PASS: tenant A/B cannot cross-read or mutate MRV provenance, organization isolation holds, and no-context runtime sees zero protected rows';
end $shakti$;

rollback;
