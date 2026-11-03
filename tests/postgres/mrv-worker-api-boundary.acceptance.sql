-- Read-only acceptance gate for the restricted MRV worker database API.
-- Run only after the API migration has been applied to a disposable PostgreSQL DB.
-- This file performs catalog assertions only; it creates/changes no objects.

begin transaction read only;

do $accept$
declare
  runtime_oid oid;
  owner_oid oid;
  required_signature text;
  api_oid oid;
  api_owner oid;
  api_config text[];
  missing text[] := array[]::text[];
  bad text[] := array[]::text[];
  required_tables text[] := array[
    'organizations','identities','organization_memberships','roles','activities',
    'evidence','verifications','geography','organization_geography_scopes',
    'mrv_observations','measurements',
    'mrv_submission_jobs','mrv_submission_job_events','mrv_provenance_events'
  ];
  table_name text;
begin
  select oid into runtime_oid from pg_roles where rolname='rupaykg_mrv_worker_runtime';
  select oid into owner_oid from pg_roles where rolname='rupaykg_mrv_worker_api_owner';

  if runtime_oid is null then
    raise exception 'MRV API acceptance: missing runtime role';
  end if;
  if owner_oid is null then
    raise exception 'MRV API acceptance: missing dedicated API owner role';
  end if;

  if exists (
    select 1 from pg_roles r
     where r.oid=runtime_oid
       and (not r.rolcanlogin or r.rolinherit or r.rolsuper or r.rolbypassrls
            or r.rolcreatedb or r.rolcreaterole or r.rolreplication)
  ) then
    raise exception 'MRV API acceptance: runtime role attributes unsafe';
  end if;
  if exists (select 1 from pg_auth_members where member=runtime_oid) then
    raise exception 'MRV API acceptance: runtime role has role memberships';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants
     where grantee='rupaykg_mrv_worker_runtime'
       and table_schema='public'
       and privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) then
    raise exception 'MRV API acceptance: runtime role has direct table privileges';
  end if;
  if has_schema_privilege(runtime_oid,'public','CREATE') then
    raise exception 'MRV API acceptance: runtime role can create in public schema';
  end if;

  if exists (
    select 1 from pg_roles r
     where r.oid=owner_oid
       and (r.rolcanlogin or r.rolinherit or r.rolsuper or r.rolbypassrls
            or r.rolcreatedb or r.rolcreaterole or r.rolreplication)
  ) then
    raise exception 'MRV API acceptance: dedicated API owner attributes unsafe';
  end if;
  if exists (select 1 from pg_auth_members where member=owner_oid)
     or exists (select 1 from pg_auth_members where roleid=owner_oid) then
    raise exception 'MRV API acceptance: dedicated API owner has memberships';
  end if;

  foreach required_signature in array array[
    'mrv_worker_api.claim_next_job(text,integer)',
    'mrv_worker_api.authorize_job(uuid)',
    'mrv_worker_api.persist_guardian_binding(uuid,uuid,text)',
    'mrv_worker_api.persist_hedera_binding(uuid,uuid,text,text,text)',
    'mrv_worker_api.renew_lease(uuid,uuid,integer)',
    'mrv_worker_api.advance_job(uuid,uuid,text,jsonb)',
    'mrv_worker_api.release_job(uuid,uuid,timestamptz,text,text)',
    'mrv_worker_api.finalize_provenance(uuid,uuid,text)'
  ] loop
    api_oid := to_regprocedure(required_signature);
    if api_oid is null then
      missing := array_append(missing,required_signature);
      continue;
    end if;

    select p.proowner,p.proconfig into api_owner,api_config
      from pg_proc p where p.oid=api_oid;

    if api_owner <> owner_oid then
      bad := array_append(bad,required_signature || ': wrong owner');
    end if;
    if not (select prosecdef from pg_proc where oid=api_oid) then
      bad := array_append(bad,required_signature || ': not SECURITY DEFINER');
    end if;
    if api_config is null or not ('search_path=pg_catalog' = any(api_config)) then
      bad := array_append(bad,required_signature || ': search_path must be pinned to pg_catalog');
    end if;
    if not has_function_privilege(runtime_oid,api_oid,'EXECUTE') then
      bad := array_append(bad,required_signature || ': runtime EXECUTE missing');
    end if;
    if exists (
      select 1
        from aclexplode(coalesce((select proacl from pg_proc where oid=api_oid),
                                 acldefault('f',api_owner))) a
       where a.grantee=0 and a.privilege_type='EXECUTE'
    ) then
      bad := array_append(bad,required_signature || ': PUBLIC EXECUTE granted');
    end if;
  end loop;

  if cardinality(missing)>0 then
    raise exception 'MRV API acceptance: missing functions: %', array_to_string(missing,', ');
  end if;
  if cardinality(bad)>0 then
    raise exception 'MRV API acceptance: unsafe functions: %', array_to_string(bad,', ');
  end if;

  foreach table_name in array required_tables loop
    if not exists (
      select 1
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname=table_name
         and c.relkind in ('r','p')
         and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'MRV API acceptance: RLS and FORCE RLS required on public.%', table_name;
    end if;
  end loop;
end
$accept$;

rollback;
