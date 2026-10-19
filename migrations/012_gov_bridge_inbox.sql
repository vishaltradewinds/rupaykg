create table gov_bridge_inbox (
  id uuid primary key default gen_random_uuid(),
  authority_code text not null check (length(authority_code) between 2 and 80),
  municipal_code text not null check (length(municipal_code) between 2 and 100),
  batch_id uuid not null,
  sync_window_timestamp timestamptz not null,
  payload jsonb not null,
  payload_sha256 char(64) not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'RECEIVED' check (status in ('RECEIVED','PROCESSING','PROCESSED','REJECTED','RETRY')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (authority_code, batch_id)
);

create index gov_bridge_inbox_status_received_idx
  on gov_bridge_inbox (status, received_at);

comment on table gov_bridge_inbox is
  'Durable inbox for signed government data mirror batches. Payloads are untrusted source records, not verified MRV measurements. No source-government database writes are performed.';
