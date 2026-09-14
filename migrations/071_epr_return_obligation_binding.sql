-- Bind each statutory EPR return to the obligation it fulfills so reconciliation is
-- auditable and cannot silently aggregate unrelated obligation categories.
alter table epr_returns
  add column if not exists obligation_id uuid references epr_obligations(id);

create index if not exists epr_returns_obligation_idx on epr_returns(obligation_id);

create or replace function enforce_epr_return_quantity()
returns trigger
language plpgsql
as $$
declare
  available_quantity numeric;
begin
  if new.obligation_id is not null then
    select greatest(target_quantity - fulfilled_quantity, 0)
      into available_quantity
    from epr_obligations
    where id = new.obligation_id
      and scheme_id = new.scheme_id
      and obligated_organization_id = new.organization_id
    for update;
  else
    select coalesce(sum(greatest(e.target_quantity - e.fulfilled_quantity,0)),0)
      into available_quantity
    from epr_obligations e
    where e.scheme_id = new.scheme_id
      and e.obligated_organization_id = new.organization_id
      and e.obligation_id in (
        select o.id from obligations o
        where o.organization_id = new.organization_id
          and o.period_start <= new.period_end
          and o.period_end >= new.period_start
      );
  end if;

  if available_quantity is null then
    raise exception 'EPR return obligation is not valid for organization and scheme';
  end if;
  if new.fulfilled_quantity > available_quantity then
    raise exception 'EPR return fulfilled quantity exceeds open obligation balance';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_return_quantity_guard on epr_returns;
create trigger epr_return_quantity_guard
before insert or update on epr_returns
for each row execute function enforce_epr_return_quantity();
