-- Shakti tenant-isolation post-RLS negative acceptance test.
-- Run only after ACTIVATE_RLS.sql succeeds, using the deployment operator that
-- can SET ROLE to the intended non-BYPASSRLS runtime role.
--
-- The test is transactional and rolls back all fixtures. It proves both
-- visibility and mutation isolation for two independent organizations.

begin;

do $$
declare
  v_missing text[] := array[]::text[];
  v_name text;
begin
  foreach v_name in array array[
    'organizations','roles','organization_memberships','activities',
    'obligations','credentials','settlements','audit_events','resource_flows',
    'field_devices','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links'
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
end $$;

do $$
declare
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_org_a uuid;
  v_org_b uuid;
  v_identity_a uuid;
  v_identity_b uuid;
  v_role_a uuid;
  v_role_b uuid;
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

  insert into organizations(id,name,organization_type,status)
  values
    (v_org_a, 'SHakti-RLS-A-'||v_suffix, 'test_fixture', 'VERIFIED'),
    (v_org_b, 'SHakti-RLS-B-'||v_suffix, 'test_fixture', 'VERIFIED');

  insert into identities(id,external_subject,display_name,email,status)
  values
    (v_identity_a,'shakti-rls-a:'||v_suffix,'Shakti RLS A','shakti-rls-a-'||v_suffix||'@example.invalid','VERIFIED'),
    (v_identity_b,'shakti-rls-b:'||v_suffix,'Shakti RLS B','shakti-rls-b-'||v_suffix||'@example.invalid','VERIFIED');

  insert into roles(id,organization_id,name,permissions,geography_scope)
  values
    (v_role_a,v_org_a,'shakti_rls_test_role_a','["dashboard:read"]'::jsonb,'[]'::jsonb),
    (v_role_b,v_org_b,'shakti_rls_test_role_b','["dashboard:read"]'::jsonb,'[]'::jsonb);

  alter table organization_memberships disable trigger stakeholder_membership_application_guard;
  insert into organization_memberships(identity_id,organization_id,role_id,status)
  values
    (v_identity_a,v_org_a,v_role_a,'VERIFIED'),
    (v_identity_b,v_org_b,v_role_b,'VERIFIED');
  alter table organization_memberships enable trigger stakeholder_membership_application_guard;

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

  reset role;

  raise notice 'RLS_NEGATIVE_TEST_PASS: tenant A can read/mutate only its own organization scope';
end $$;

rollback;
