-- Close the organization-transfer edge case in migration 093.
-- A scope row cannot be moved out of an organization with assessed history,
-- nor moved into one, because either operation changes the policy record set.
create or replace function prevent_geography_scope_rewrite_after_assessment()
returns trigger
language plpgsql
as $$
declare
  old_org_has_history boolean := false;
  new_org_has_history boolean := false;
begin
  if tg_op <> 'INSERT' then
    select exists (
      select 1
      from activities a
      where a.organization_id = old.organization_id
        and (
          exists (select 1 from icvcm_ccp_assessments c where c.activity_id = a.id)
          or exists (
            select 1
            from evidence e
            join epr_returns r on r.external_confirmation_evidence_id = e.id
            where e.activity_id = a.id and r.status in ('ACCEPTED', 'COMPLETED')
          )
        )
    ) into old_org_has_history;
  end if;

  if tg_op <> 'DELETE' then
    select exists (
      select 1
      from activities a
      where a.organization_id = new.organization_id
        and (
          exists (select 1 from icvcm_ccp_assessments c where c.activity_id = a.id)
          or exists (
            select 1
            from evidence e
            join epr_returns r on r.external_confirmation_evidence_id = e.id
            where e.activity_id = a.id and r.status in ('ACCEPTED', 'COMPLETED')
          )
        )
    ) into new_org_has_history;
  end if;

  if old_org_has_history or new_org_has_history then
    raise exception 'organization geography scope policy is immutable after accepted EPR or ICVCM assessment history; use a versioned policy change';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
