-- Shakti context liveness completion.
-- The initial liveness migration hardened platform/authority contexts. This
-- follow-up explicitly closes the authenticated identity context boundary.

create schema if not exists app;

create or replace function app.set_identity_context(p_identity_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as 'begin
  if p_identity_id is null then
    raise exception ''Identity context requires identity_id'';
  end if;

  if not exists (
    select 1
      from identities
     where id = p_identity_id
       and status = ''VERIFIED''
       and suspended_at is null
  ) then
    raise exception ''Identity is not active'';
  end if;

  perform set_config(''app.identity_id'', p_identity_id::text, true);
  perform set_config(''app.execution_scope'', ''IDENTITY'', true);
end;';

grant execute on function app.set_identity_context(uuid) to rupaykg_app_runtime;

comment on function app.set_identity_context(uuid) is
'Shakti authenticated identity context. Validates live identity status and establishes transaction-local IDENTITY scope.';
