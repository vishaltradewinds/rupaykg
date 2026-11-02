-- EPR obligation/return lifecycle. Quantities and regulatory assertions remain evidence-backed.

alter table epr_obligations
  add column if not exists source_evidence_id uuid references evidence(id),
  add column if not exists source_verification_id uuid references verifications(id),
  add column if not exists target_basis jsonb not null default '{}',
  add column if not exists fulfilled_at timestamptz;

create index if not exists epr_obligations_org_status_idx
  on epr_obligations(obligated_organization_id,status);

create table if not exists epr_returns (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references epr_schemes(id),
  organization_id uuid not null references organizations(id),
  period_start date not null,
  period_end date not null,
  return_type text not null,
  reported_quantity numeric(20,6) not null check (reported_quantity >= 0),
  obligation_quantity numeric(20,6),
  fulfilled_quantity numeric(20,6) not null default 0 check (fulfilled_quantity >= 0),
  status lifecycle_status not null default 'DRAFT',
  external_reference text,
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(scheme_id,organization_id,period_start,period_end,return_type)
);

create index if not exists epr_returns_org_period_idx
  on epr_returns(organization_id,period_start,period_end);

create or replace function enforce_epr_return_quantity()
returns trigger
language plpgsql
as $$
declare
  available_quantity numeric;
begin
  select coalesce(sum(greatest(e.target_quantity - e.fulfilled_quantity,0)),0)
    into available_quantity
  from epr_obligations e
  where e.scheme_id = new.scheme_id
    and e.obligated_organization_id = new.organization_id
    and e.obligation_id in (
      select o.id from obligations o
      where o.organization_id = new.organization_id
        and o.period_start <= new.period_end
        and o.period_end >= new.period_start
    );

  if new.fulfilled_quantity > available_quantity then
    raise exception 'EPR return fulfilled quantity exceeds open obligation balance';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_return_quantity_guard on epr_returns;
create trigger epr_return_quantity_guard
before insert or update on epr_returns
for each row execute function enforce_epr_return_quantity();

create or replace function enforce_epr_transfer_evidence()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('APPROVED','ACTIVE','COMPLETED') and (new.evidence_id is null or new.verification_id is null) then
    raise exception 'EPR certificate transfer requires evidence and verification';
  end if;
  return new;
end;
$$;

drop trigger if exists epr_transfer_evidence_guard on epr_credit_transfers;
create trigger epr_transfer_evidence_guard
before insert or update on epr_credit_transfers
for each row execute function enforce_epr_transfer_evidence();
