-- Role-level geography authorization for agentic read workflows.
-- An empty role geography_scope inherits organization-level scope for backwards compatibility.
-- A non-empty array contains UUID roots; descendants of those roots are included.
-- Missing roles and malformed scope values fail closed.
create or replace function role_has_geography_scope(
  p_role_id uuid,
  p_geography_id uuid
) returns boolean
language sql stable as $$
  with recursive role_data as (
    select r.geography_scope
    from roles r
    where r.id = p_role_id
  ),
  role_roots as (
    select scopes.scope_id
    from role_data rd
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(rd.geography_scope) = 'array'
           then rd.geography_scope else '[]'::jsonb end
    ) as scopes(scope_id)
  ),
  ancestors(id) as (
    select g.id from geography g where g.id = p_geography_id
    union all
    select g.parent_id from geography g
    join ancestors a on a.id = g.id
    where g.parent_id is not null
  )
  select case
    when not exists (select 1 from role_data) then false
    when (select jsonb_typeof(geography_scope) from role_data) <> 'array' then false
    when jsonb_array_length((select geography_scope from role_data)) = 0 then true
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
