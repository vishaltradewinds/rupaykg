\set ON_ERROR_STOP on

-- Shakti runtime acceptance for SECURITY DEFINER boundary migration 101.
-- This validates the actual disposable PostgreSQL privilege state, not only SQL text.

do $$
declare
  public_create_public boolean;
  public_create_app boolean;
  unexpected_public_execute integer;
  missing_runtime_execute integer;
  unexpected_runtime_execute integer;
  unsafe_search_path integer;
  default_public_execute integer;
begin
  select has_schema_privilege('public', 'public', 'CREATE')
    into public_create_public;
  if public_create_public then
    raise exception 'SECURITY DEFINER boundary failed: PUBLIC retains CREATE on schema public';
  end if;

  select has_schema_privilege('public', 'app', 'CREATE')
    into public_create_app;
  if public_create_app then
    raise exception 'SECURITY DEFINER boundary failed: PUBLIC retains CREATE on schema app';
  end if;

  select count(*)
    into unexpected_public_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and p.prosecdef
     and has_function_privilege('public', p.oid, 'EXECUTE');
  if unexpected_public_execute <> 0 then
    raise exception 'SECURITY DEFINER boundary failed: % app SECURITY DEFINER function(s) retain PUBLIC EXECUTE', unexpected_public_execute;
  end if;

  select count(*)
    into unsafe_search_path
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and p.prosecdef
     and not exists (
       select 1
         from unnest(coalesce(p.proconfig, '{}'::text[])) setting
        where setting in ('search_path=public, app', 'search_path=pg_catalog, public, app')
     );
  if unsafe_search_path <> 0 then
    raise exception 'SECURITY DEFINER boundary failed: % app SECURITY DEFINER function(s) have an unapproved search_path', unsafe_search_path;
  end if;

  select count(*)
    into missing_runtime_execute
    from (
      values
        ('app.current_identity_id()'::text),
        ('app.current_organization_id()'::text),
        ('app.set_request_context(uuid,uuid)'::text),
        ('app.set_identity_context(uuid)'::text),
        ('app.set_platform_context(uuid)'::text),
        ('app.set_authority_context(uuid,text,uuid)'::text),
        ('app.is_assigned_approved_verifier(uuid)'::text)
    ) required(signature)
   where not exists (
     select 1
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app'
        and format('%I.%s(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) = required.signature
        and p.prosecdef
        and has_function_privilege('rupaykg_app_runtime', p.oid, 'EXECUTE')
   );
  if missing_runtime_execute <> 0 then
    raise exception 'SECURITY DEFINER boundary failed: % required runtime SECURITY DEFINER function(s) lack runtime EXECUTE', missing_runtime_execute;
  end if;

  select count(*)
    into unexpected_runtime_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and p.prosecdef
     and has_function_privilege('rupaykg_app_runtime', p.oid, 'EXECUTE')
     and format('%I.%s(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) not in (
       'app.current_identity_id()',
       'app.current_organization_id()',
       'app.set_request_context(uuid,uuid)',
       'app.set_identity_context(uuid)',
       'app.set_platform_context(uuid)',
       'app.set_authority_context(uuid,text,uuid)',
       'app.is_assigned_approved_verifier(uuid)'
     );
  if unexpected_runtime_execute <> 0 then
    raise exception 'SECURITY DEFINER boundary failed: % app SECURITY DEFINER function(s) have unapproved runtime EXECUTE';
  end if;

  select count(*)
    into default_public_execute
    from pg_default_acl d
    cross join lateral aclexplode(coalesce(d.defaclacl, '{}'::aclitem[])) x
   where d.defaclrole = (select oid from pg_roles where rolname = current_user)
     and d.defaclobjtype = 'f'
     and x.grantee = 0
     and x.privilege_type = 'EXECUTE';
  if default_public_execute <> 0 then
    raise exception 'SECURITY DEFINER boundary failed: PUBLIC retains default EXECUTE on functions for migration role %', current_user;
  end if;

  raise notice 'Shakti SECURITY DEFINER runtime boundary PASSED';
end
$$;
