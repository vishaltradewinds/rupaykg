-- Strict geography authorization for compliance/MRV/value paths.
-- Keep organization_has_geography_scope's legacy fallback for older workflows, but
-- high-impact evidence, statutory, MRV and value paths must require an explicit
-- verified root before accepting any geography.
create or replace function organization_has_explicit_geography_scope(
  p_organization_id uuid,
  p_geography_id uuid
) returns boolean
language sql stable as $$
  select p_geography_id is not null
    and exists (
      select 1 from organization_geography_scopes s
      where s.organization_id = p_organization_id
        and s.status = 'VERIFIED'
    )
    and organization_has_geography_scope(p_organization_id, p_geography_id);
$$;

comment on function organization_has_explicit_geography_scope(uuid, uuid) is
  'Strict authorization for high-impact compliance/MRV/value operations: requires at least one verified organization geography root and the requested geography within that root. Does not change legacy helper semantics.';
