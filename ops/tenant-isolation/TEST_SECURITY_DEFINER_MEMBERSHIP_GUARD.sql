-- Disposable PostgreSQL negative test for migration 104's isolated-owner
-- membership guard. The transaction rolls back both probe roles and grants.
begin;

do $test$
declare
  owner_oid oid;
  probe_oid oid;
begin
  select oid into owner_oid
    from pg_roles
   where rolname = 'rupaykg_security_definer';

  if owner_oid is null then
    raise exception 'SECURITY_DEFINER_MEMBERSHIP_TEST_BLOCKED: isolated owner role is missing';
  end if;

  execute 'create role rupaykg_security_definer_membership_probe nologin';
  select oid into probe_oid
    from pg_roles
   where rolname = 'rupaykg_security_definer_membership_probe';

  -- Case 1: the SECURITY DEFINER owner is itself a member of another role.
  execute 'grant rupaykg_security_definer_membership_probe to rupaykg_security_definer';
  if not exists (
    select 1 from pg_auth_members
     where member = owner_oid
       and roleid = probe_oid
  ) then
    raise exception 'SECURITY_DEFINER_MEMBERSHIP_TEST_FAILED: owner membership was not detected';
  end if;

  execute 'revoke rupaykg_security_definer_membership_probe from rupaykg_security_definer';

  -- Case 2: another role can assume the SECURITY DEFINER owner.
  execute 'grant rupaykg_security_definer to rupaykg_security_definer_membership_probe';
  if not exists (
    select 1 from pg_auth_members
     where member = probe_oid
       and roleid = owner_oid
  ) then
    raise exception 'SECURITY_DEFINER_MEMBERSHIP_TEST_FAILED: membership into owner was not detected';
  end if;

  -- Exact fail-closed predicate used by migration 104.
  if not exists (
    select 1
      from pg_auth_members
     where member = owner_oid
        or roleid = owner_oid
  ) then
    raise exception 'SECURITY_DEFINER_MEMBERSHIP_TEST_FAILED: migration guard predicate did not reject membership';
  end if;
end
$test$;

rollback;
