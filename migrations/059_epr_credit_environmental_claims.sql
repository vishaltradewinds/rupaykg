-- EPR credits are consuming environmental value claims, not merely reporting records.
-- The claim is anchored to the verified activity/evidence/verification and the EPR scheme.
-- Reuse of the same activity basis by a different value claim type is blocked by 056.

create or replace function record_epr_credit_value_claim()
returns trigger
language plpgsql
as $$
declare
  v_organization_id uuid;
  v_framework_code text;
  v_evidence_id uuid;
  v_verification_id uuid;
begin
  if NEW.status in ('ELIGIBLE','ISSUED','ACTIVE') then
    if NEW.activity_id is null or NEW.evidence_id is null or NEW.verification_id is null then
      raise exception using
        errcode = '23514',
        message = 'Value-eligible EPR credit requires activity, evidence and verification provenance';
    end if;

    select epr.issuer_organization_id, 'CPCB_EPR:' || s.code, epr.evidence_id, epr.verification_id
      into v_organization_id, v_framework_code, v_evidence_id, v_verification_id
    from epr_credits epr
    join epr_schemes s on s.id = epr.scheme_id
    where epr.id = NEW.id;

    perform allocate_environmental_attribute_claim(
      v_organization_id,
      NEW.activity_id,
      'EPR',
      v_framework_code,
      s.code,
      NEW.quantity,
      NEW.unit,
      'activity:' || NEW.activity_id::text,
      'EPR_CREDIT',
      NEW.id,
      v_evidence_id,
      v_verification_id,
      jsonb_build_object('schemeId', NEW.scheme_id, 'eprCreditId', NEW.id)
    )
    from epr_schemes s
    where s.id = NEW.scheme_id;
  end if;

  return NEW;
end;
$$;

create trigger epr_credit_environmental_claim
after insert on epr_credits
for each row execute function record_epr_credit_value_claim();

comment on function record_epr_credit_value_claim() is
  'Creates an authoritative consuming EPR environmental-attribute claim for value-eligible EPR credits; official CPCB acceptance remains external.';
