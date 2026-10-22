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
