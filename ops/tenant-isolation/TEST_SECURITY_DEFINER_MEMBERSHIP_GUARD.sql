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
  if not exists (
    select 1 from pg_auth_members
     where member = owner_oid
  ) then
    raise exception 'SECURITY_DEFINER_MEMBERSHIP_TEST_FAILED: outbound owner membership was not rejected';
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
  if not exists (
    select 1
      from pg_auth_members membership
     where membership.roleid = owner_oid
       and membership.member = probe_oid
       and not (
         pg_get_userbyid(membership.grantor) = 'cloud_admin'
         and membership.admin_option
         and not membership.inherit_option
         and not membership.set_option
       )
  ) then
    raise exception 'SECURITY_DEFINER_MEMBERSHIP_TEST_FAILED: incoming probe membership was not rejected';
  end if;
  execute 'revoke rupaykg_security_definer from rupaykg_security_definer_membership_probe';

  -- The owner must never inherit/SET another role, and no ordinary role may
  -- assume it. The sole Neon platform-admin membership edge is allowed only
  -- when it is non-inheriting and non-SET, so it cannot enter SECURITY DEFINER
  -- ownership through role switching.
  if exists (
    select 1
      from pg_auth_members membership
      left join pg_roles member_role on member_role.oid = membership.member
     where membership.member = owner_oid
        or (
          membership.roleid = owner_oid
          and not (
            member_role.rolname = 'rupaykg'
            and pg_get_userbyid(membership.grantor) = 'cloud_admin'
            and membership.admin_option
            and not membership.inherit_option
            and not membership.set_option
          )
        )
  ) then
    raise exception 'SECURITY_DEFINER_MEMBERSHIP_TEST_FAILED: unexpected owner membership remained';
  end if;
end
$test$;

rollback;
