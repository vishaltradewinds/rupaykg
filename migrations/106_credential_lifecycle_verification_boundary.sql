-- 106: Credential lifecycle verification boundary.
--
-- Verification is a prerequisite for issuance/activation. Transfer and retirement
-- operate on an already-issued credential and must not re-evaluate the issuer's
-- verification row under the current owner's tenant RLS context. The credential's
-- immutable registry/MRV provenance remains authoritative for those later lifecycle
-- transitions.

create or replace function public.prevent_unverified_credential_issue()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app
as $trigger$
begin
  if new.status in ('ISSUED','ACTIVE') then
    if not exists (
      select 1
        from public.verifications verification_row
       where verification_row.id = new.verification_id
         and verification_row.activity_id = new.activity_id
         and verification_row.decision = 'APPROVED'
    ) then
      raise exception 'credential verification must be approved';
    end if;
  end if;

  return new;
end;
$trigger$;

comment on function public.prevent_unverified_credential_issue()
is 'Database credential lifecycle guard: approved verification is required for issuance/activation; transfer and retirement rely on the already-established credential provenance and do not re-evaluate issuer verification across tenant RLS.';
