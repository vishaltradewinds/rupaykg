-- Registry and settlement guardrails.
-- Value cannot become transferable/settleable without verified upstream evidence.

alter table credentials add column if not exists verification_id uuid references verifications(id);
alter table credentials add column if not exists methodology_version_id uuid references methodology_versions(id);
alter table credentials add column if not exists quantity numeric(20,6) check (quantity is null or quantity > 0);
alter table credentials add column if not exists unit text;

alter table registry_events add column if not exists verification_id uuid references verifications(id);
alter table registry_events add column if not exists recorded_by_identity_id uuid references identities(id);

alter table settlements add column if not exists authorization_reference text;
alter table settlements add column if not exists verified_at timestamptz;

create table settlement_events (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references settlements(id),
  event_type text not null,
  actor_identity_id uuid references identities(id),
  external_reference text,
  event_hash text not null,
  created_at timestamptz not null default now()
);

create index registry_credential_idx on registry_events(credential_id, created_at);
create index settlement_events_settlement_idx on settlement_events(settlement_id, created_at);

create or replace function prevent_unverified_credential_issue()
returns trigger language plpgsql as $$
begin
  if new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
    if new.verification_id is null then
      raise exception 'credential cannot reach value-bearing state without verification';
    end if;
    if not exists (select 1 from verifications v where v.id = new.verification_id and v.decision = 'APPROVED') then
      raise exception 'credential verification must be approved';
    end if;
  end if;
  return new;
end;
$$;

create trigger credentials_verification_guard
before insert or update on credentials
for each row execute function prevent_unverified_credential_issue();

create or replace function prevent_unverified_settlement()
returns trigger language plpgsql as $$
begin
  if new.status in ('EXECUTING','RECONCILING','SETTLED') then
    if new.verified_at is null or new.authorization_reference is null then
      raise exception 'settlement requires verification and authorization reference';
    end if;
  end if;
  return new;
end;
$$;

create trigger settlements_verification_guard
before insert or update on settlements
for each row execute function prevent_unverified_settlement();
