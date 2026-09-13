-- Database API for explicit environmental-attribute allocation.
-- Value-producing routes must allocate a declared basis before representing an
-- EPR/carbon/other environmental value claim. ESG reporting remains non-consuming.

create or replace function assert_environmental_attribute_available(
  p_basis_key text,
  p_claim_type text
)
returns void
language plpgsql
as $$
begin
  if p_basis_key is null or btrim(p_basis_key) = '' then
    raise exception using
      errcode = '23514',
      message = 'Environmental attribute basis is required';
  end if;

  if exists (
    select 1
    from environmental_attribute_claims c
    where c.basis_key = p_basis_key
      and c.consumption_mode = 'VALUE_CLAIM'
      and c.status = 'ACTIVE'
      and c.claim_type <> p_claim_type
  ) then
    raise exception using
      errcode = '23514',
      message = 'Environmental attribute basis is already consumed by a different claim type',
      detail = 'An explicit distinct authoritative allocation is required before another value claim can consume this basis.';
  end if;
end;
$$;

create or replace function allocate_environmental_attribute_claim(
  p_organization_id uuid,
  p_activity_id uuid,
  p_claim_type text,
  p_framework_code text,
  p_mechanism_code text,
  p_claim_quantity numeric,
  p_claim_unit text,
  p_basis_key text,
  p_source_type text,
  p_source_id uuid,
  p_evidence_id uuid default null,
  p_verification_id uuid default null,
  p_metadata jsonb default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_claim_type not in ('EPR','CARBON','ESG','OTHER') then
    raise exception using errcode = '23514', message = 'Unsupported environmental claim type';
  end if;
  if p_claim_quantity is null or p_claim_quantity <= 0 then
    raise exception using errcode = '23514', message = 'Environmental claim quantity must be positive';
  end if;
  if p_claim_unit is null or btrim(p_claim_unit) = '' then
    raise exception using errcode = '23514', message = 'Environmental claim unit is required';
  end if;

  perform assert_environmental_attribute_available(p_basis_key, p_claim_type);

  insert into environmental_attribute_claims (
    organization_id, activity_id, evidence_id, verification_id,
    claim_type, framework_code, mechanism_code, claim_quantity, claim_unit,
    basis_key, consumption_mode, source_type, source_id, status, metadata
  ) values (
    p_organization_id, p_activity_id, p_evidence_id, p_verification_id,
    p_claim_type, p_framework_code, p_mechanism_code, p_claim_quantity, p_claim_unit,
    p_basis_key, 'VALUE_CLAIM', p_source_type, p_source_id, 'ACTIVE', coalesce(p_metadata, '{}')
  ) returning id into v_id;

  return v_id;
end;
$$;

comment on function assert_environmental_attribute_available(text,text) is
  'Precondition for consuming an environmental attribute basis in an EPR/carbon/other value claim.';
comment on function allocate_environmental_attribute_claim(uuid,uuid,text,text,text,numeric,text,text,text,uuid,uuid,uuid,jsonb) is
  'Atomic database API for recording an explicit value claim against an environmental attribute basis.';
