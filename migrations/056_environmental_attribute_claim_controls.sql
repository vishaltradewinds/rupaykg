-- Environmental-attribute control ledger.
-- Reporting references may coexist across EPR/carbon/ESG. Value claims are explicit,
-- framework-bound and must declare the authoritative basis they consume.
-- This prevents the platform from silently treating one physical activity as multiple
-- interchangeable environmental assets while preserving legitimate ESG reporting.

create table environmental_attribute_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  activity_id uuid not null references activities(id),
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  claim_type text not null check (claim_type in ('EPR','CARBON','ESG','OTHER')),
  framework_code text not null,
  mechanism_code text,
  claim_quantity numeric(20,8) not null check (claim_quantity > 0),
  claim_unit text not null,
  basis_key text not null,
  consumption_mode text not null check (consumption_mode in ('REPORTING_REFERENCE','VALUE_CLAIM')),
  source_type text not null,
  source_id uuid not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RETIRED','CANCELLED')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique(source_type, source_id)
);

create index environmental_claim_activity_idx
  on environmental_attribute_claims(activity_id, status);
create index environmental_claim_basis_idx
  on environmental_attribute_claims(basis_key, consumption_mode, status);
create index environmental_claim_framework_idx
  on environmental_attribute_claims(framework_code, claim_type, status);

-- A value claim consumes an explicit basis. One active value claim owns that basis.
-- A different authoritative allocation must use a distinct basis key. ESG reporting
-- references remain non-consuming and may coexist with value claims.
create or replace function prevent_environmental_attribute_double_claim()
returns trigger
language plpgsql
as $$
begin
  if NEW.consumption_mode = 'VALUE_CLAIM' and NEW.status = 'ACTIVE' then
    -- Serialize competing claims for the same basis so concurrent transactions cannot
    -- both pass the availability check.
    perform pg_advisory_xact_lock(hashtextextended(NEW.basis_key, 0));
    if exists (
      select 1
      from environmental_attribute_claims c
      where c.basis_key = NEW.basis_key
        and c.consumption_mode = 'VALUE_CLAIM'
        and c.status = 'ACTIVE'
        and c.id <> NEW.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Environmental attribute basis is already consumed',
        detail = 'Use an explicitly authorized distinct basis allocation when the governing framework permits coexistence.';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger environmental_attribute_double_claim_guard
before insert or update on environmental_attribute_claims
for each row execute function prevent_environmental_attribute_double_claim();

comment on table environmental_attribute_claims is
  'Authoritative ledger separating non-consuming reporting references from consuming EPR/carbon/other environmental value claims.';
comment on column environmental_attribute_claims.basis_key is
  'Authoritative allocation basis identifier. Reuse means the same underlying environmental attribute is being claimed.';
comment on column environmental_attribute_claims.consumption_mode is
  'REPORTING_REFERENCE does not consume value; VALUE_CLAIM consumes the declared environmental attribute basis.';
