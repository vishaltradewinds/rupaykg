-- Shakti context liveness completion.
-- Explicitly closes the authenticated identity context boundary.

create schema if not exists app;

create or replace function app.set_identity_context(p_identity_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $shakti$
begin
  if p_identity_id is null then
    raise exception 'Identity context requires identity_id';
  end if;

  if not exists (
    select 1
      from identities
     where id = p_identity_id
       and status = 'VERIFIED'
       and suspended_at is null
  ) then
    raise exception 'Identity is not active';
  end if;

  perform set_config('app.identity_id', p_identity_id::text, true);
  perform set_config('app.execution_scope', 'IDENTITY', true);
end;
$shakti$;

grant execute on function app.set_identity_context(uuid) to rupaykg_app_runtime;

do $shakti$
begin
  if to_regprocedure('app.set_identity_context(uuid)') is null then
    raise exception 'Shakti identity context function was not installed';
  end if;
end;
$shakti$;

comment on function app.set_identity_context(uuid) is
'Shakti authenticated identity context. Validates live identity status and establishes transaction-local IDENTITY scope.';
