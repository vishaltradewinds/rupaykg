-- Keep API and database retirement semantics aligned: failed settlements are terminal,
-- not open obligations that permanently prevent retirement of an otherwise eligible credential.
create or replace function prevent_credential_retirement_with_open_settlement()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'RETIRED' and old.status <> 'RETIRED' and exists (
    select 1
    from settlements s
    where s.credential_id = new.id
      and s.status not in ('SETTLED', 'CANCELLED', 'FAILED')
  ) then
    raise exception 'Credential cannot be retired while a settlement is open'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function prevent_credential_retirement_with_open_settlement() is
  'Prevents retirement while a settlement is active; SETTLED, CANCELLED and FAILED are terminal for retirement eligibility.';


-- Align transfer safety and active-settlement uniqueness with the same terminal-state definition.
create or replace function prevent_transfer_with_open_settlement()
returns trigger language plpgsql as $$
begin
  if new.event_type = 'TRANSFERRED' then
    if exists (
      select 1 from settlements
      where credential_id = new.credential_id
        and status not in ('SETTLED','CANCELLED','FAILED')
    ) then
      raise exception 'credential cannot be transferred while a settlement is open';
    end if;
  end if;
  return new;
end;
$$;

drop index if exists settlements_active_credential_party_uq;
create unique index settlements_active_credential_party_uq
  on settlements(credential_id, payer_id, payee_id)
  where status not in ('SETTLED','CANCELLED','FAILED');
