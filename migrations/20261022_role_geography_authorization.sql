-- Role-level geography authorization for agentic read workflows.
-- An empty role geography_scope inherits organization-level scope for backwards compatibility.
-- A non-empty array contains UUID roots; descendants of those roots are included.
create or replace function role_has_geography_scope(
  p_role_id uuid,
  p_geography_id uuid
) returns boolean
language sql stable as $$
  with role_roots as (
    select scopes.scope_id
    from roles r
    cross join lateral jsonb_array_elements_text(r.geography_scope) as scopes(scope_id)
    where r.id = p_role_id
  ),
  ancestors(id) as (
    select g.id from geography g where g.id = p_geography_id
    union all
    select g.parent_id from geography g
    join ancestors a on a.id = g.id
    where g.parent_id is not null
  )
  select case
    when not exists (select 1 from role_roots) then true
    when exists (
      select 1 from role_roots rr
      where rr.scope_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then false
    else exists (
      select 1 from role_roots rr
      join ancestors a on a.id = rr.scope_id::uuid
    )
  end;
$$;
