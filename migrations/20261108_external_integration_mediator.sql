-- Shakti external integration mediator persistence.
-- Idempotency and tenant ownership are enforced before an external message can
-- enter the authoritative integration boundary.

create table if not exists external_integration_messages (
  id uuid primary key default gen_random_uuid(),
  integration_id text not null,
  contract_version text not null,
  correlation_id text not null,
  idempotency_key text not null,
  organization_id uuid not null references organizations(id),
  actor_identity_id uuid references identities(id),
  direction text not null check (direction in ('INBOUND','OUTBOUND','BIDIRECTIONAL')),
  kind text not null check (kind in ('COMMAND','EVENT','OBSERVATION','RESPONSE')),
  occurred_at timestamptz not null,
  source_system text not null,
  target_system text not null,
  schema text not null,
  payload jsonb not null,
  status text not null default 'ACCEPTED'
    check (status in ('ACCEPTED','DUPLICATE','REJECTED','PROCESSED','FAILED')),
  external_reference text,
  failure_class text,
  failure_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint external_integration_messages_idempotency_uq
    unique (integration_id, organization_id, idempotency_key)
);

create index if not exists external_integration_messages_org_created_idx
  on external_integration_messages (organization_id, created_at desc);

create index if not exists external_integration_messages_correlation_idx
  on external_integration_messages (correlation_id);

comment on table external_integration_messages is
'Shakti controlled external integration boundary. External responses do not become authoritative MRV, registry or regulatory state without explicit domain validation and authorization.';
