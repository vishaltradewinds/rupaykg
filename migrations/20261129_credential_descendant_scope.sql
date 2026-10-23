-- Align registry credential geography enforcement with the platform's explicit
-- verified-root + descendant authorization model. The earlier 049 guard used exact
-- geography equality and incorrectly rejected valid activities below an approved root.
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
       or not organization_has_explicit_geography_scope(new.issuer_organization_id, activity_geography_id) then
      raise exception 'credential activity geography is outside issuer organization authorization scope';
    end if;
  end if;

  return new;
end;
$$;

comment on function prevent_credential_out_of_scope_issue() is
  'Value-bearing credentials require issuer-owned activities inside an explicit verified geography root, including valid descendants.';
