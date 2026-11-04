-- Fail closed when an organization has no verified geography roots.
-- A missing or pending scope is not an authorization grant. This forward-only
-- replacement deliberately changes the legacy "no roots => true" behavior.
--
-- Scope is valid for the assigned root itself and its descendants. UNION (not
-- UNION ALL) makes traversal terminate even if legacy geography data contains
-- an unexpected parent cycle.

create or replace function public.organization_has_geography_scope(
  p_organization_id uuid,
  p_geography_id uuid
) returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  with recursive ancestors(id) as (
    select g.id
      from public.geography g
     where g.id = p_geography_id
    union
    select g.parent_id
      from public.geography g
      join ancestors a on a.id = g.id
     where g.parent_id is not null
  )
  select
    p_organization_id is not null
    and p_geography_id is not null
    and exists (
      select 1
        from public.organization_geography_scopes s
        join ancestors a on a.id = s.geography_id
       where s.organization_id = p_organization_id
         and s.status::text = 'VERIFIED'
    );
$$;

comment on function public.organization_has_geography_scope(uuid, uuid) is
  'Fail-closed geography authorization: requires a verified organization geography root equal to or ancestral to the requested geography; missing, pending or foreign scopes return false.';
