-- EPR lifecycle controls: RupayKG records evidence-backed compliance state and
-- externally issued references; it does not impersonate CPCB registration or issuance.

alter table organization_epr_applicability
  add column if not exists registration_evidence_id uuid references evidence(id),
  add column if not exists registration_verification_id uuid references verifications(id),
  add column if not exists registration_recorded_at timestamptz;

create index if not exists organization_epr_registration_evidence_idx
  on organization_epr_applicability(registration_evidence_id);

create table if not exists epr_credit_transfers (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references epr_credits(id),
  from_organization_id uuid not null references organizations(id),
  to_organization_id uuid not null references organizations(id),
  quantity numeric(20,6) not null check (quantity > 0),
  external_reference text,
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  status lifecycle_status not null default 'OPEN',
  transferred_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_organization_id <> to_organization_id)
);

create index if not exists epr_credit_transfers_credit_idx on epr_credit_transfers(credit_id);
create index if not exists epr_credit_transfers_to_org_idx on epr_credit_transfers(to_organization_id);

alter table epr_credits
  add column if not exists external_certificate_reference text,
  add column if not exists valid_from date,
  add column if not exists valid_until date,
  add column if not exists issued_at timestamptz;

create index if not exists epr_credits_external_reference_idx
  on epr_credits(external_certificate_reference)
  where external_certificate_reference is not null;

-- Prevent a transfer from exceeding the quantity recorded on its source credit.
create or replace function enforce_epr_transfer_quantity()
returns trigger
language plpgsql
as $$
declare
  credit_quantity numeric;
  committed_quantity numeric;
begin
  select quantity into credit_quantity from epr_credits where id = new.credit_id for update;
  if credit_quantity is null then
    raise exception 'EPR credit not found';
  end if;

  select coalesce(sum(quantity),0) into committed_quantity
  from epr_credit_transfers
  where credit_id = new.credit_id
    and status in ('OPEN','APPROVED','ACTIVE','COMPLETED');

  if committed_quantity + new.quantity > credit_quantity then
    raise exception 'EPR transfer quantity exceeds available certificate quantity';
  end if;

  return new;
end;
$$;

drop trigger if exists epr_transfer_quantity_guard on epr_credit_transfers;
create trigger epr_transfer_quantity_guard
before insert on epr_credit_transfers
for each row execute function enforce_epr_transfer_quantity();
