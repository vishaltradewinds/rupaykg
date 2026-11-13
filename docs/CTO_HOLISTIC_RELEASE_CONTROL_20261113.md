# RupayKg Holistic Release Control — 2026-11-13

Status: ACTIVE ENGINEERING CONTROL  
Repository: `vishaltradewinds/rupaykg`  
Base: `main`  
Branch: `cto/20261113-holistic-release-convergence`

## CTO decision

The platform is in **convergence/hardening**, not feature-expansion mode.

The authoritative architecture remains:

Regulatory → Evidence → MRV → IoT/Measurement → Data → AI → Registry/Integrity → Workflow → Reporting → Ecosystem Integrations

Urban, rural, peri-urban, industrial and regional deployments are controlled configurations of the same platform.

## Release gates

| Gate | Required evidence | Current decision |
|---|---|---|
| Current HEAD CI | Successful CI on current release candidate | **PASS** — CI run 6808 on `ec4ce27f...` completed successfully |
| Migration reconciliation | Read-only production/staging comparison | **PARTIAL / OPEN** — production schema_migrations reaches `20261021`; repository head contains migrations through `100` plus dated migrations |
| Runtime identity | Verified identity + active membership | OPEN |
| Runtime DB role | Non-BYPASSRLS runtime role | **OPEN** — current production connection role `rupaykg` reports `rolbypassrls=true`; dedicated `rupaykg_app_runtime` exists in schema |
| RLS | Enabled and tested in target runtime | **PARTIAL / OPEN** — 17 public tables currently report RLS enabled; 50 remain disabled; no production acceptance claim |
| Cross-tenant negative tests | Tenant A cannot read/write tenant B | **OPEN** — repository has a controlled negative-test script, but authoritative production acceptance evidence is not yet recorded |
| Urban Golden Transaction | Real end-to-end acceptance evidence | OPEN |
| Rural Golden Transaction | Real end-to-end acceptance evidence | OPEN |
| Physical measurement | Authenticated measurement/evidence | OPEN |
| Guardian | Authenticated authoritative execution | OPEN |
| Hedera/HCS | Authoritative consensus + Mirror Node evidence | OPEN |
| CPCB/EPR/etc. | Authoritative external confirmation where applicable | OPEN |
| Backup/restore | Tested recovery evidence | OPEN |
| Monitoring/rollback | Operational evidence | OPEN |
| Production acceptance | All material gates closed | BLOCKED |

## Golden transactions

### Urban

Generator → Collection/Aggregator → Transport → Processor/Recycler → Measurement → Evidence → Verification → MRV → Provenance → Report

Minimum actors:
- Generator
- Aggregator/collector
- Transporter
- Processor/Recycler
- ULB/operator
- Verifier

### Rural

Household/institution → Gram Panchayat → Collection/Aggregation → Transport → Processor/Recycler → Measurement → Evidence → Verification → MRV → Provenance → Report

Minimum actors:
- Generator
- Gram Panchayat
- Aggregator/collector
- Transporter
- Processor/Recycler
- Verifier

## Truthfulness rules

- Never convert demo/simulated evidence into verified evidence.
- Never infer CPCB/other government approval from an internal RupayKg state.
- Never call CI green without a successful run on the current release candidate.
- Never enable production RLS before runtime identity/context and negative cross-tenant tests are proven.
- Never modify production Neon during this hardening gate unless an explicitly approved migration is ready and the required evidence exists.
- Never claim TRL 9 from architecture or software completeness alone.

## Stakeholder acceptance matrix

| Stakeholder | Must be able to do | Evidence produced |
|---|---|---|
| Generator | create/submit activity | source activity + identity |
| Aggregator | receive/aggregate/move material | custody + measurement |
| Transporter | execute movement | movement + time/location |
| Processor/Recycler | receive/process/output | input/output measurement |
| ULB | govern urban workflow | authoritative operational state |
| Gram Panchayat | govern rural workflow | local authority/community evidence |
| Verifier | review and decide | verification record |
| Regulator | inspect/report | traceable compliance package |
| Producer/Brand | consume EPR evidence | obligation/output lineage |
| Buyer | consume recovered material/value | provenance |
| Auditor | sample/reconcile | assurance trail |

## Engineering sequence

1. Prove current-head CI.
2. Reconcile migrations read-only.
3. Close runtime tenant-isolation gate.
4. Execute Urban Golden Transaction.
5. Execute Rural Golden Transaction.
6. Connect authenticated physical measurement.
7. Execute Guardian/Hedera authoritative path.
8. Close operational backup/restore/rollback gates.
9. Produce release evidence bundle.
10. Only then decide production acceptance and TRL progression.

## Non-goals

This control does not:
- certify statutory compliance;
- certify CPCB approval;
- certify carbon credits;
- certify Hedera immutability;
- certify TRL 9;
- replace independent audit or government approval.

Those require their own authoritative evidence.

## Exit criterion

A release candidate may be called **production-ready** only when every material gate above is evidenced against the candidate itself and no P0/P1 blocker remains.

