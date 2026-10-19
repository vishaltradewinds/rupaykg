-- Fail-closed distinction between internal RupayKg credentials and official external registry instruments.
-- Existing rows are classified as internal records; no historical row is promoted to an official CCC.
alter table credentials
  add column if not exists credential_origin text not null default 'RUPAYKG_INTERNAL_MRV';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'credentials_origin_internal_only'
      and conrelid = 'credentials'::regclass
  ) then
    alter table credentials
      add constraint credentials_origin_internal_only
      check (credential_origin = 'RUPAYKG_INTERNAL_MRV');
  end if;
end $$;

comment on column credentials.credential_origin is
  'Fail-closed classification. Current release permits only RUPAYKG_INTERNAL_MRV; this is not an official Carbon Credit Certificate or government registry instrument.';
