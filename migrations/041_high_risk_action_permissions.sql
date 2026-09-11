-- High-risk action authorization boundary.
-- Organization membership alone is insufficient for credential/settlement mutations.

create or replace function identity_has_permission(actor_id uuid, permission_code text, allowed_role_names text[] default '{}')
returns boolean language sql stable as $$
  select exists (
    select 1
      from organization_memberships om
      join roles r on r.id = om.role_id
     where om.identity_id = actor_id
       and om.status = 'VERIFIED'
       and (
         r.permissions @> jsonb_build_array(permission_code)
         or lower(r.name) = any(allowed_role_names)
       )
  );
$$;

create or replace function enforce_registry_event_permission()
returns trigger language plpgsql as $$
declare
  permission_code text;
  role_names text[];
begin
  if new.event_type = 'ISSUED' then
    permission_code := 'ISSUE_CREDENTIAL';
    role_names := array['issuer','registry_operator'];
  elsif new.event_type = 'TRANSFERRED' then
    permission_code := 'TRANSFER_CREDENTIAL';
    role_names := array['issuer','registry_operator'];
  elsif new.event_type = 'RETIRED' then
    permission_code := 'RETIRE_CREDENTIAL';
    role_names := array['issuer','registry_operator'];
  else
    return new;
  end if;

  if new.recorded_by_identity_id is null
     or not identity_has_permission(new.recorded_by_identity_id, permission_code, role_names) then
    raise exception 'registry event requires explicit permission: %', permission_code;
  end if;

  return new;
end;
$$;

drop trigger if exists registry_high_risk_permission_guard on registry_events;
create trigger registry_high_risk_permission_guard
before insert on registry_events
for each row execute function enforce_registry_event_permission();

create or replace function enforce_settlement_event_permission()
returns trigger language plpgsql as $$
declare
  permission_code text;
  role_names text[];
begin
  if new.event_type = 'AUTHORIZED' then
    permission_code := 'AUTHORIZE_SETTLEMENT';
    role_names := array['settlement_operator','finance_operator'];
  elsif new.event_type in ('EXECUTED','RECONCILING','SETTLED') then
    permission_code := 'SETTLE_FUNDS';
    role_names := array['settlement_operator','finance_operator'];
  else
    return new;
  end if;

  if new.actor_identity_id is null
     or not identity_has_permission(new.actor_identity_id, permission_code, role_names) then
    raise exception 'settlement event requires explicit permission: %', permission_code;
  end if;

  return new;
end;
$$;

drop trigger if exists settlement_high_risk_permission_guard on settlement_events;
create trigger settlement_high_risk_permission_guard
before insert on settlement_events
for each row execute function enforce_settlement_event_permission();
