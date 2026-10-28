-- Preserve the authorization-scope basis used by accepted EPR and ICVCM history.
-- Scope rows are organization policy inputs: removing the last VERIFIED root can
-- make organization_has_geography_scope() fall back to permissive legacy behavior.
-- Once an organization has assessed history, scope policy changes must be versioned
-- in a future schema rather than rewritten in place.
create or replace function prevent_geography_scope_rewrite_after_assessment()
returns trigger
language plpgsql
as $$
declare
  affected_organization_id uuid;
begin
  affected_organization_id := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;

  if exists (
    select 1
    from activities a
    where a.organization_id = affected_organization_id
      and (
        exists (
          select 1
          from icvcm_ccp_assessments c
          where c.activity_id = a.id
        )
        or exists (
          select 1
          from evidence e
          join epr_returns r on r.external_confirmation_evidence_id = e.id
          where e.activity_id = a.id
            and r.status in ('ACCEPTED', 'COMPLETED')
        )
      )
  ) then
    raise exception 'organization geography scope policy is immutable after accepted EPR or ICVCM assessment history; use a versioned policy change';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists organization_geography_scope_history_guard on organization_geography_scopes;
create trigger organization_geography_scope_history_guard
before insert or update or delete on organization_geography_scopes
for each row execute function prevent_geography_scope_rewrite_after_assessment();

comment on function prevent_geography_scope_rewrite_after_assessment() is
  'Prevents retroactive changes to geography authorization policy after accepted EPR or ICVCM assessment history. Versioned policy changes require a future explicit model.';
