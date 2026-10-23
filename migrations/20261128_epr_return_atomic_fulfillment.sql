-- Make EPR return fulfillment accounting atomic and database-authoritative.
-- Every write path (HTTP route, worker or direct SQL) must reserve an obligation exactly once.
-- Rejection reverses the previous reservation; acceptance/completion do not reserve again.
create or replace function enforce_epr_return_quantity()
returns trigger
language plpgsql
as $$
declare
  v_target numeric;
  v_fulfilled numeric;
  v_available numeric;
begin
  if new.obligation_id is null then
    if new.status in ('SUBMITTED','ACCEPTED','COMPLETED') then
      raise exception 'EPR_RETURN_OBLIGATION_REQUIRED';
    end if;
    return new;
  end if;

  select target_quantity, fulfilled_quantity
    into v_target, v_fulfilled
  from epr_obligations
  where id = new.obligation_id
    and scheme_id = new.scheme_id
    and obligated_organization_id = new.organization_id
  for update;

  if not found then
    raise exception 'EPR_RETURN_OBLIGATION_INVALID';
  end if;

  -- The accounting trigger below performs reservation/reversal. This guard checks
  -- capacity only when entering a submitted state, not during accepted/completed updates.
  if new.status in ('SUBMITTED','ACCEPTED','COMPLETED') then
    if tg_op = 'UPDATE' and old.status in ('SUBMITTED','ACCEPTED','COMPLETED') then
      if new.obligation_id is distinct from old.obligation_id
        or new.organization_id is distinct from old.organization_id
        or new.scheme_id is distinct from old.scheme_id
        or new.reported_quantity is distinct from old.reported_quantity
        or new.fulfilled_quantity is distinct from old.fulfilled_quantity
        or new.evidence_id is distinct from old.evidence_id
        or new.verification_id is distinct from old.verification_id
        or new.period_start is distinct from old.period_start
        or new.period_end is distinct from old.period_end then
        raise exception 'EPR_RETURN_SUBMITTED_BASIS_IMMUTABLE';
      end if;
      return new;
    end if;

    v_available := greatest(v_target - v_fulfilled, 0);
    if new.reported_quantity is null or new.reported_quantity <= 0
      or new.reported_quantity > v_available then
      raise exception 'EPR_RETURN_OBLIGATION_CAPACITY_EXCEEDED';
    end if;
  elsif tg_op = 'UPDATE'
    and old.status in ('SUBMITTED','ACCEPTED','COMPLETED')
    and new.status = 'REJECTED' then
    -- A rejected submission releases its previously reserved quantity.
    v_available := greatest(v_target - v_fulfilled + old.fulfilled_quantity, 0);
    if old.fulfilled_quantity > v_available then
      raise exception 'EPR_RETURN_REJECTION_BALANCE_INVALID';
    end if;
  end if;

  return new;
end;
$$;

create or replace function reconcile_epr_return_obligation_fulfillment()
returns trigger
language plpgsql
as $$
declare
  v_target numeric;
  v_fulfilled numeric;
  v_was_submitted boolean := false;
  v_is_submitted boolean;
begin
  v_is_submitted := new.status in ('SUBMITTED','ACCEPTED','COMPLETED');
  if tg_op = 'UPDATE' then
    v_was_submitted := old.status in ('SUBMITTED','ACCEPTED','COMPLETED');
  end if;

  if tg_op = 'UPDATE' and v_was_submitted and v_is_submitted then
    return new;
  end if;

  if tg_op = 'UPDATE' and v_was_submitted and new.status = 'REJECTED' then
    update epr_obligations
       set fulfilled_quantity = greatest(fulfilled_quantity - old.fulfilled_quantity, 0),
           status = case
             when greatest(fulfilled_quantity - old.fulfilled_quantity, 0) < target_quantity then 'OPEN'
             else status
           end
     where id = old.obligation_id
       and scheme_id = old.scheme_id
       and obligated_organization_id = old.organization_id
       and fulfilled_quantity >= old.fulfilled_quantity;
    if not found then
      raise exception 'EPR_RETURN_REJECTION_ACCOUNTING_MISMATCH';
    end if;
    return new;
  end if;

  if v_is_submitted and not v_was_submitted then
    if new.obligation_id is null then
      raise exception 'EPR_RETURN_OBLIGATION_REQUIRED';
    end if;
    select target_quantity, fulfilled_quantity
      into v_target, v_fulfilled
    from epr_obligations
    where id = new.obligation_id
      and scheme_id = new.scheme_id
      and obligated_organization_id = new.organization_id
    for update;
    if not found then
      raise exception 'EPR_RETURN_OBLIGATION_INVALID';
    end if;
    if new.reported_quantity is null or new.reported_quantity <= 0
      or new.reported_quantity > greatest(v_target - v_fulfilled, 0) then
      raise exception 'EPR_RETURN_OBLIGATION_CAPACITY_EXCEEDED';
    end if;

    new.fulfilled_quantity := new.reported_quantity;
    new.obligation_quantity := v_target;
    update epr_obligations
       set fulfilled_quantity = fulfilled_quantity + new.fulfilled_quantity,
           status = case
             when fulfilled_quantity + new.fulfilled_quantity >= target_quantity then 'COMPLIANT'
             else 'OPEN'
           end
     where id = new.obligation_id;
  elsif tg_op = 'UPDATE' and v_was_submitted and not v_is_submitted and new.status <> 'REJECTED' then
    raise exception 'EPR_RETURN_INVALID_SUBMITTED_STATE_TRANSITION';
  end if;

  return new;
end;
$$;

drop trigger if exists epr_return_submission_capacity_guard on epr_returns;
create trigger epr_return_submission_capacity_guard
before insert or update of status, fulfilled_quantity, reported_quantity, obligation_id, organization_id, scheme_id, period_start, period_end, evidence_id, verification_id
on epr_returns
for each row execute function reconcile_epr_return_obligation_fulfillment();

comment on function reconcile_epr_return_obligation_fulfillment() is
  'Database-authoritative EPR return accounting: atomically reserves quantity on submission, prevents repeated accounting during acceptance/completion, freezes submitted basis, and releases reservation on rejection.';
