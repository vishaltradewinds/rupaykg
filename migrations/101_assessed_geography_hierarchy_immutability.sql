-- Geography ancestry is part of the authorization decision: organization_has_geography_scope()
-- walks parent_id links. Re-parenting a node after accepted EPR or ICVCM history can
-- retroactively change whether that activity was inside its organization's scope.
create or replace function prevent_assessed_geography_hierarchy_rewrite()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not distinct from old.parent_id then
    return new;
  end if;

  if exists (
    with recursive relevant_geographies(id) as (
      select old.id
      union
      select g.id
      from geography g
      join relevant_geographies r on g.parent_id = r.id
    ),
    assessed_activities as (
      select a.id, a.geography_id, a.organization_id
      from activities a
      where a.geography_id is not null
        and (
          exists (
            select 1
            from evidence e
            join epr_returns r on r.external_confirmation_evidence_id = e.id
            where e.activity_id = a.id and r.status in ('ACCEPTED','COMPLETED')
          )
          or exists (select 1 from icvcm_ccp_assessments c where c.activity_id = a.id)
        )
    )
    select 1
    from assessed_activities a
    where a.geography_id in (select id from relevant_geographies)
       or exists (
         select 1 from organization_geography_scopes s
         where s.organization_id = a.organization_id
           and s.status = 'VERIFIED'
           and s.geography_id in (select id from relevant_geographies)
       )
  ) then
    raise exception 'geography hierarchy backing accepted EPR or ICVCM assessment history is immutable; use a versioned geography correction';
  end if;

  return new;
end;
$$;

drop trigger if exists assessed_geography_hierarchy_immutable on geography;
create trigger assessed_geography_hierarchy_immutable
before update of parent_id on geography
for each row execute function prevent_assessed_geography_hierarchy_rewrite();
