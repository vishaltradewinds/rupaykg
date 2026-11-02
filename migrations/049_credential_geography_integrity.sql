-- Registry issuance must remain inside the issuer organization's authoritative geography scope.
-- This is a database-level invariant so direct SQL cannot bypass the API boundary.

create or replace function prevent_credential_out_of_scope_issue()
returns trigger language plpgsql as $$
declare
  activity_organization_id uuid;
  activity_geography_id uuid;
begin
  if new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
    select a.organization_id, a.geography_id
      into activity_organization_id, activity_geography_id
      from activities a
     where a.id = new.activity_id;

    if activity_organization_id is null or activity_organization_id <> new.issuer_organization_id then
      raise exception 'credential activity must belong to issuer organization';
    end if;

    if activity_geography_id is null
       or not exists (
         select 1
           from organization_geography_scopes s
          where s.organization_id = new.issuer_organization_id
            and s.geography_id = activity_geography_id
            and s.status = 'VERIFIED'
       ) then
      raise exception 'credential activity geography is outside issuer organization authorization scope';
    end if;
  end if;

  return new;
end;
$$;

create trigger credentials_geography_guard
before insert or update on credentials
for each row execute function prevent_credential_out_of_scope_issue();
