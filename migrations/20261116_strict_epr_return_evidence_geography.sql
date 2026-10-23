-- Enforce evidence and explicit jurisdiction scope when an EPR return becomes a
-- submitted/accepted/completed compliance record, including writes that bypass HTTP routes.
-- Draft preparation remains possible; unrelated updates to legacy rows do not invoke this guard.
create or replace function enforce_epr_return_submission_evidence()
returns trigger
language plpgsql
as $$
declare
  evidence_ok boolean;
begin
  if new.status in ('SUBMITTED','ACCEPTED','COMPLETED') then
    if new.evidence_id is null or new.verification_id is null or new.obligation_id is null then
      raise exception 'EPR_RETURN_EVIDENCE_REQUIRED';
    end if;

    if new.period_start > new.period_end then
      raise exception 'EPR_RETURN_PERIOD_INVALID';
    end if;

    select exists(
      select 1
      from epr_obligations eo
      join evidence e on e.id = new.evidence_id
      join activities a on a.id = e.activity_id
      join verifications v on v.id = new.verification_id
        and v.evidence_id = e.id
        and v.activity_id = a.id
        and v.decision = 'APPROVED'
      where eo.id = new.obligation_id
        and eo.scheme_id = new.scheme_id
        and eo.obligated_organization_id = new.organization_id
        and exists (
          select 1 from obligations o
          where o.id = eo.obligation_id
            and o.period_start <= new.period_end
            and o.period_end >= new.period_start
        )
        and e.status = 'VERIFIED'
        and a.organization_id = new.organization_id
        and a.geography_id is not null
        and (e.content_hash is not null or e.content_uri is not null)
        and organization_has_explicit_geography_scope(a.organization_id, a.geography_id)
    ) into evidence_ok;

    if not evidence_ok then
      raise exception 'EPR_RETURN_EVIDENCE_FORBIDDEN';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists epr_return_submission_evidence_guard on epr_returns;
create trigger epr_return_submission_evidence_guard
before insert or update of status, organization_id, scheme_id, obligation_id, period_start, period_end, evidence_id, verification_id
on epr_returns
for each row execute function enforce_epr_return_submission_evidence();

comment on function enforce_epr_return_submission_evidence() is
  'Fail-closed database boundary for submitted EPR returns: requires bound obligation, verified provenance-backed evidence, matching approved verification, overlapping obligation period, and explicit verified geography scope.';
