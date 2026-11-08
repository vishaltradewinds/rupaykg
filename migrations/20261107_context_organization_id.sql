-- Shakti tenant execution context accessors.
-- These functions are intentionally small, transaction-local accessors used by
-- tenant RLS policies and runtime authorization. They do not establish authority.

create schema if not exists app;

create or replace function app.current_organization_id()
returns uuid
language sql
security definer
stable
set search_path = public, app
as 'select nullif(current_setting(''app.organization_id'', true), '''')::uuid';

grant execute on function app.current_organization_id() to rupaykg_app_runtime;

comment on function app.current_organization_id() is
'Shakti tenant RLS accessor. Returns the transaction-local authenticated organization context, or NULL when no tenant context is established.';
