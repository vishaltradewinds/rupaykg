-- Make EPR environmental value claims transition-safe and provenance-bound.
-- The previous trigger ran only on INSERT, allowing a DRAFT credit to become value-eligible
-- later without allocating its consuming environmental-attribute claim.
-- Active claims are intentionally not auto-released when a credit leaves an eligible status;
-- release/retirement requires a separate governed action so a status edit cannot free the basis.
create or replace function record_epr_credit_value_claim()
returns trigger
language plpgsql
as $$
declare
  v_framework_code text;
  v_mechanism_code text;
  v_existing environmental_attribute_claims%rowtype;
  v_provenance_ok boolean;
begin
  if NEW.status in ('ELIGIBLE','ISSUED','ACTIVE') then
    if NEW.activity_id is null or NEW.evidence_id is null or NEW.verification_id is null then
      raise exception using
        errcode = '23514',
        message = 'Value-eligible EPR credit requires activity, evidence and verification provenance';
    end if;

    select 'CPCB_EPR:' || s.code, s.code
      into v_framework_code, v_mechanism_code
    from epr_schemes s
    where s.id = NEW.scheme_id and s.status = 'VERIFIED';

    if v_framework_code is null then
      raise exception using
        errcode = '23514',
        message = 'Value-eligible EPR credit requires a verified EPR scheme';
    end if;

    select exists(
      select 1
      from activities a
      join evidence e on e.id = NEW.evidence_id
        and e.activity_id = a.id
      join verifications v on v.id = NEW.verification_id
        and v.evidence_id = e.id
        and v.activity_id = a.id
        and v.decision = 'APPROVED'
      where a.id = NEW.activity_id
        and e.status = 'VERIFIED'
        and (e.content_hash is not null or e.content_uri is not null)
        and a.geography_id is not null
        and organization_has_explicit_geography_scope(a.organization_id, a.geography_id)
    ) into v_provenance_ok;

    if not v_provenance_ok then
      raise exception using
        errcode = '23514',
        message = 'Value-eligible EPR credit requires verified, approved, provenance-backed evidence within explicit activity geography scope';
    end if;

    select * into v_existing
    from environmental_attribute_claims c
    where c.source_type = 'EPR_CREDIT'
      and c.source_id = NEW.id
      and c.consumption_mode = 'VALUE_CLAIM'
      and c.status = 'ACTIVE'
    for update;

    if found then
      if v_existing.organization_id <> NEW.issuer_organization_id
        or v_existing.activity_id <> NEW.activity_id
        or v_existing.evidence_id is distinct from NEW.evidence_id
        or v_existing.verification_id is distinct from NEW.verification_id
        or v_existing.claim_quantity <> NEW.quantity
        or v_existing.claim_unit <> NEW.unit
        or v_existing.framework_code <> v_framework_code
        or v_existing.mechanism_code is distinct from v_mechanism_code
        or v_existing.basis_key <> 'activity:' || NEW.activity_id::text then
        raise exception using
          errcode = '23514',
          message = 'EPR_CREDIT_VALUE_CLAIM_IMMUTABLE: provenance, quantity, scheme or basis cannot change after value claim allocation';
      end if;
      return NEW;
    end if;

    perform allocate_environmental_attribute_claim(
      NEW.issuer_organization_id,
      NEW.activity_id,
      'EPR',
      v_framework_code,
      v_mechanism_code,
      NEW.quantity,
      NEW.unit,
      'activity:' || NEW.activity_id::text,
      'EPR_CREDIT',
      NEW.id,
      NEW.evidence_id,
      NEW.verification_id,
      jsonb_build_object('schemeId', NEW.scheme_id, 'eprCreditId', NEW.id)
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists epr_credit_environmental_claim on epr_credits;
create trigger epr_credit_environmental_claim
after insert or update of status, activity_id, evidence_id, verification_id, scheme_id, issuer_organization_id, quantity, unit
on epr_credits
for each row execute function record_epr_credit_value_claim();

comment on function record_epr_credit_value_claim() is
  'Allocates one consuming EPR environmental-attribute claim on insert or transition to value-eligible status; enforces verified scoped provenance and freezes claim basis after allocation. Non-eligible status changes do not automatically release the consumed basis.';
