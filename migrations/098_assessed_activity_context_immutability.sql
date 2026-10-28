-- Preserve the activity context against which accepted EPR returns and
-- append-only ICVCM assessments were evaluated.
create or replace function prevent_assessed_activity_context_rewrite()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from evidence e
      join epr_returns r on r.external_confirmation_evidence_id = e.id
      where e.activity_id = old.id and r.status in ('ACCEPTED','COMPLETED')
    ) then
      raise exception 'activity backing accepted EPR external confirmation cannot be deleted';
    end if;
    if exists (select 1 from icvcm_ccp_assessments c where c.activity_id = old.id) then
      raise exception 'activity with ICVCM assessment history cannot be deleted';
    end if;
    return old;
  end if;

  if (new.organization_id is distinct from old.organization_id
      or new.geography_id is distinct from old.geography_id) then
    if exists (
      select 1 from evidence e
      join epr_returns r on r.external_confirmation_evidence_id = e.id
      where e.activity_id = old.id and r.status in ('ACCEPTED','COMPLETED')
    ) then
      raise exception 'activity organization/geography backing accepted EPR confirmation is immutable';
    end if;
    if exists (select 1 from icvcm_ccp_assessments c where c.activity_id = old.id) then
      raise exception 'activity organization/geography backing ICVCM assessment history is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists assessed_activity_context_immutable on activities;
create trigger assessed_activity_context_immutable
before update of organization_id, geography_id or delete on activities
for each row execute function prevent_assessed_activity_context_rewrite();
