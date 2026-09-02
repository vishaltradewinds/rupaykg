-- Field/offline synchronization ledger.
-- Client operations are durable, idempotent and never overwrite authoritative state implicitly.

create table field_sync_envelopes (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references field_devices(id),
  identity_id uuid not null references identities(id),
  idempotency_key text not null,
  client_sequence bigint not null,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text not null,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','APPLIED','REJECTED','CONFLICT')),
  applied_at timestamptz,
  rejection_code text,
  rejection_reason text,
  server_cursor bigint,
  unique (device_id, idempotency_key),
  unique (device_id, client_sequence)
);

create table field_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references field_sync_envelopes(id),
  entity_type text not null,
  entity_id uuid,
  conflict_type text not null,
  authoritative_version jsonb,
  client_version jsonb,
  resolution_status text not null default 'OPEN' check (resolution_status in ('OPEN','RESOLVED','REJECTED')),
  resolution_reason text,
  resolved_by_identity_id uuid references identities(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table field_sync_cursors (
  device_id uuid primary key references field_devices(id),
  acknowledged_cursor bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index field_sync_identity_idx on field_sync_envelopes(identity_id, received_at desc);
create index field_sync_status_idx on field_sync_envelopes(status, received_at desc);
create index field_sync_conflict_status_idx on field_sync_conflicts(resolution_status, created_at desc);

create or replace function field_sync_payload_hash()
returns trigger language plpgsql as $$
begin
  new.payload_hash := encode(digest(new.payload::text, 'sha256'), 'hex');
  return new;
end;
$$;

create trigger field_sync_payload_hash_guard
before insert or update of payload on field_sync_envelopes
for each row execute function field_sync_payload_hash();

create or replace function prevent_field_sync_mutation()
returns trigger language plpgsql as $$
begin
  if old.status in ('APPLIED','REJECTED','CONFLICT') and (new.payload is distinct from old.payload or new.device_id is distinct from old.device_id or new.client_sequence is distinct from old.client_sequence) then
    raise exception 'processed sync envelope is append-only';
  end if;
  return new;
end;
$$;

create trigger field_sync_append_only_guard
before update on field_sync_envelopes
for each row execute function prevent_field_sync_mutation();
