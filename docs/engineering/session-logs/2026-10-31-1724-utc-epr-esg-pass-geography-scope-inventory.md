# 2026-10-31 17:24 UTC — verified EPR/ESG evidence tests passed; geography fail-open caller inventory

## CI acceptance
- Implementation SHA `452cd4a54e2197b4103539e3279bf60e66625c15`.
- CI #4026 / run `41223276559`: SUCCESS on exact SHA: https://github.com/vishaltradewinds/rupaykg/actions/runs/41223276559
- Extends actual Evidence Vault upload and independent reviewer approval tests to EPR and ESG report writes. Unreviewed evidence rejected; correctly matched evidence + approved verification accepted; EPR remains `NOT_SUBMITTED` externally.

## Read-only authoritative production DB investigation
- Project `rupaykg-production-fresh` / project id `steep-mud-79906940`, primary branch `br-restless-base-b44cip2h`, database `rupaykg`.
- Reconfirmed `organization_has_geography_scope(organization_id, geography_id)` returns TRUE when no VERIFIED geography scope exists for that organization. This is permissive-by-default and is not fail-closed.
- Direct stored-procedure source search found three caller functions:
  1. `enforce_activity_geography_scope()` — attached as BEFORE INSERT OR UPDATE trigger `activity_geography_scope_guard` on `activities`; checks `new.geography_id` when non-null.
  2. `enforce_resource_flow_geography_scope()` — attached as BEFORE INSERT OR UPDATE trigger `resource_flow_geography_scope_guard` on `resource_flows`; checks non-null source and destination geography.
  3. `enforce_epr_external_registration_evidence()` — attached as BEFORE INSERT OR UPDATE trigger `epr_external_registration_evidence_guard` on `organization_epr_applicability`; when external registration is declared, requires verified evidence + approved verification + content provenance + activity geography, then calls the same geography helper.
- No other public stored-procedure source matches the helper name; no direct trigger definitions contain the helper string (they call wrappers above). No public views matched in previous attempt (query returned none when combined call was rejected; need single query if view inventory needed).
- Implication: the permissive default affects activity geography, both resource-flow endpoints and external EPR registration evidence scope whenever an org has no VERIFIED scopes. Current production tenant/membership/scope tables were previously confirmed empty, so no live organization currently exercises this path; still a future onboarding/security defect.
- Do NOT change production. Next: inspect all call sites in migrations/app services/onboarding, determine intended legacy semantics, add disposable-DB positive and negative cases, then propose staged fail-closed change with explicit compatibility review and migration evidence.

## Safety boundary
- Production database queries were read-only. No production writes, migrations, grants, deployment, worker/scheduler or certification activation.
- A verified evidence-bound BWG report remains an application workflow status, not CPCB approval, registry issuance, carbon-credit eligibility or settlement.
