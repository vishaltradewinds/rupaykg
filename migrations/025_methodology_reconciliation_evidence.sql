-- Independent reconciliation/regression evidence is authoritative governance data.
-- A methodology cannot become production-eligible from a status flag alone:
-- source provenance, implementation mapping, numerical reconciliation and
-- regression evidence must all be present and independently referenced.

create table methodology_governance_evidence (
  id uuid primary key default gen_random_uuid(),
  methodology_version_id uuid not null references methodology_versions(id),
  evidence_kind text not null check (evidence_kind in ('NUMERICAL_RECONCILIATION','REGRESSION_TEST')),
  reference text not null,
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  independent_party text not null,
  captured_at timestamptz not null default now(),
  evidence jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(methodology_version_id, evidence_kind, reference)
);

create index methodology_governance_evidence_methodology_idx
  on methodology_governance_evidence(methodology_version_id, evidence_kind);

create or replace function prevent_methodology_governance_evidence_mutation()
returns trigger language plpgsql as $$
begin
  if old.methodology_version_id is distinct from new.methodology_version_id
     or old.evidence_kind is distinct from new.evidence_kind
     or old.reference is distinct from new.reference
     or old.evidence_hash is distinct from new.evidence_hash
     or old.independent_party is distinct from new.independent_party
     or old.captured_at is distinct from new.captured_at
     or old.evidence is distinct from new.evidence then
    raise exception 'methodology governance evidence is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists methodology_governance_evidence_immutability_guard on methodology_governance_evidence;
create trigger methodology_governance_evidence_immutability_guard
before update on methodology_governance_evidence
for each row execute function prevent_methodology_governance_evidence_mutation();

create or replace function enforce_methodology_governance_requirements()
returns trigger language plpgsql as $$
declare
  numerical_count integer;
  regression_count integer;
begin
  if new.governance_status in ('IMPLEMENTATION_MAPPED','NUMERICALLY_RECONCILED','REGRESSION_VERIFIED','PRODUCTION_ELIGIBLE') then
    if new.source_reference is null or new.source_hash is null then
      raise exception 'methodology governance requires locked source reference and hash';
    end if;
    if new.applicability_rules = '{}'::jsonb or new.parameter_dictionary = '{}'::jsonb or new.equation_mapping = '{}'::jsonb then
      raise exception 'methodology governance requires applicability, parameter and equation mappings';
    end if;
  end if;

  if new.governance_status in ('NUMERICALLY_RECONCILED','REGRESSION_VERIFIED','PRODUCTION_ELIGIBLE') then
    if new.reconciliation_reference is null or new.reconciled_at is null then
      raise exception 'methodology governance requires numerical reconciliation evidence';
    end if;
  end if;

  if new.governance_status in ('REGRESSION_VERIFIED','PRODUCTION_ELIGIBLE') and new.regression_verified_at is null then
    raise exception 'methodology governance requires regression verification evidence';
  end if;

  if new.governance_status = 'PRODUCTION_ELIGIBLE' then
    if new.reconciliation_evidence = '[]'::jsonb then
      raise exception 'methodology governance requires reconciliation evidence for production eligibility';
    end if;

    select count(*) filter (where evidence_kind = 'NUMERICAL_RECONCILIATION'),
           count(*) filter (where evidence_kind = 'REGRESSION_TEST')
      into numerical_count, regression_count
      from methodology_governance_evidence
     where methodology_version_id = new.id;

    if numerical_count < 1 then
      raise exception 'methodology production eligibility requires independent numerical reconciliation evidence';
    end if;
    if regression_count < 1 then
      raise exception 'methodology production eligibility requires independent regression evidence';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists methodology_governance_requirements_guard on methodology_versions;
create trigger methodology_governance_requirements_guard
before insert or update on methodology_versions
for each row execute function enforce_methodology_governance_requirements();
