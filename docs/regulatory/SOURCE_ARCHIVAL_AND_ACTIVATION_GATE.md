# Regulatory Source Archival and Activation Gate
**Applies to:** RupayKg EPR, ESG/BRSR, Indian Carbon Market/CCTS/CCC rule packs  
**Status:** Engineering control specification — not legal advice or production approval  
**Rule:** A portal listing or summary is discovery evidence, not sufficient evidence to activate a statutory rule.

## 1. Purpose and separation of concerns

This gate converts official-source research into reproducible, reviewable rule inputs. It does not itself decide legal applicability, approve a methodology, submit a return, validate a carbon project, or issue a certificate.

Keep these states separate:
- Source discovered: an official page or document was located.
- Source archived: exact bytes were retained with provenance and a cryptographic hash.
- Source reviewed: a legal/domain reviewer assessed the instrument, amendments, commencement, transition, supersession and scope.
- Rule configured: a versioned machine-readable rule was prepared from the reviewed source.
- Rule activated: all required approvals and tests passed and a controlled release explicitly enabled it.
- External outcome observed: an authoritative portal/registry reference confirms the actual filing, acceptance, transfer or issuance.

No state may be inferred from a preceding state.

## 2. Minimum source evidence record

Each source artifact must have a stable record with at least:

| Field | Requirement |
|---|---|
| source_id | Stable internal identifier; never reuse it for a different instrument |
| instrument_title | Exact title as published by the issuing authority |
| issuing_authority | CPCB, MoEFCC, BEE, SEBI or other competent authority |
| instrument_type | Act, rule, Gazette notification, order, circular, procedure, methodology, portal manual, consultation draft or landing page |
| official_source_url | Canonical official URL; preserve redirects and retrieval URL separately |
| publication_date | Date on the instrument, if stated |
| notification_or_circular_number | Exact identifier, if applicable |
| commencement_date | Exact legal commencement date, including staged commencement |
| effective_from / effective_to | Version validity interval; null only with explicit review disposition |
| retrieved_at_utc | Timestamp of retrieval |
| media_type / byte_length | Actual downloaded artifact metadata |
| sha256 | SHA-256 of the exact archived bytes, computed after download |
| archive_location | Immutable or versioned internal artifact reference |
| supersedes / amended_by | Explicit links to related instruments, where established |
| applicability_scope | Waste stream, actor/entity type, jurisdiction, reporting period, mechanism and thresholds as applicable |
| review_status | DISCOVERED, ARCHIVE_PENDING, REVIEW_REQUIRED, REVIEWED, APPROVED, REJECTED or SUPERSEDED |
| reviewer / approval_reference | Accountable reviewer and durable approval record; no implied approval |
| extraction_notes | Page/paragraph/schedule references supporting each rule field |
| limitations | Missing annexures, unreadable scans, uncertain commencement, unresolved conflicts or other caveats |

Do not store a null hash with a status that implies archival is complete. If the official file cannot be fetched or verified, keep it ARCHIVE_PENDING and the dependent rule INACTIVE.

## 3. Exact archival procedure

1. Navigate from the competent authority's official website or an authenticated government repository. Third-party summaries may help discovery but are not the legal source of record.
2. Download the complete original artifact, including schedules, annexures and corrigenda. For a Gazette instrument, archive the Gazette PDF rather than only a press release or portal summary.
3. Record the final URL, retrieval timestamp, HTTP/content metadata where available, and exact byte length.
4. Compute SHA-256 locally over the downloaded bytes. Recompute it after storage and compare. Never copy a hash from a webpage or invent one.
5. Preserve the original bytes unchanged. Store extracted text/OCR as a separate derivative with tool/version and page-level linkage to the original.
6. Independently inspect title, notification number, publication date, commencement clause, amendments, corrigenda, transition/savings clauses, repeal/supersession and relevant schedules.
7. Create an amendment/supersession chain. Do not assume the newest page is the newest legally effective instrument, or that a portal's current content proves which rule applied in an earlier reporting period.
8. Record unresolved uncertainty explicitly. Missing pages, inaccessible annexures, conflicting dates or an unverified hash block activation for affected rules.

## 4. Applicability decision is a separate, auditable object

For each organization/activity/reporting period, persist:
- verified legal role and relevant registration/authorization;
- jurisdiction and facility/activity geography;
- waste/material stream and category;
- financial/reporting period and relevant dates;
- instrument/version and clauses/schedules used;
- applicability decision: APPLICABLE, NOT_APPLICABLE, UNKNOWN or PENDING_REVIEW;
- structured reason codes and evidence references;
- decision engine/version, decision timestamp and reviewer where required.

UNKNOWN and PENDING_REVIEW must never be treated as NOT_APPLICABLE or silently converted into a zero obligation. Preserve historical decisions when rules change; generate a new versioned decision rather than overwriting the record.

## 5. Domain-specific hard stops

### EPR and waste rules
- Keep plastic packaging, battery, e-waste, tyre, used oil, solid waste and other waste-stream instruments distinct unless a reviewed legal mapping explicitly links them.
- Validate actor role, registration, category, target schedule, unit, reporting year, authorized facility and certificate lifecycle against the applicable instrument and current official portal requirements.
- A local return, receipt, weighbridge record or external-reference string is not proof of regulator submission, acceptance or certificate issuance.
- Rejected/cancelled quantities require a traceable reversal/reconciliation event before resubmission or reallocation.

### ESG / SEBI BRSR
- Resolve listed-entity and reporting-period applicability using the current SEBI framework and amendments. Do not make BRSR universally mandatory for all MSMEs, recyclers, municipalities or projects.
- Persist reporting boundary, metric definition, unit, source lineage, calculation/factor version, estimate flags, restatements and applicable assurance/assessment status.
- VERIFIED, ASSURED and PUBLISHED are different states and require separate evidence. A generated export is not regulator filing or assurance.

### CCTS / CCC
- Keep the CCTS compliance mechanism separate from the project-based offset mechanism.
- Archive the exact applicable procedure, approved methodology and tools, sector eligibility rules, forms and relevant amendments. A methodology appearing on a BEE page is not project eligibility or certificate issuance.
- Do not infer registration, validation, verification, issuance, transfer or retirement from waste tonnage, EPR certificates, ESG metrics or modeled emission reductions.
- Persist actual authoritative project/registry identifiers and observed statuses; use NOT_OBSERVED when no authoritative status has been confirmed.
- Treat ICVCM Core Carbon Principles as a supplemental voluntary integrity benchmark, never as a substitute for Indian law, CCTS eligibility or government issuance.

## 6. Activation gates (all required)

A rule pack may be considered for activation only after all gates below are evidenced:
1. Source integrity: exact official bytes archived; SHA-256 verified; complete annexures/schedules present.
2. Temporal integrity: publication, commencement, transition, amendment, repeal and supersession chronology reviewed.
3. Applicability: actor, stream, jurisdiction, period, thresholds and exclusions represented explicitly.
4. Interpretation review: independent legal/domain review approves the mapping from clauses to structured rule fields.
5. Engineering review: schema validation, deterministic calculations, units, rounding, boundary conditions, idempotency and audit lineage reviewed.
6. Regression tests: effective-date boundaries, prior-period replay, amendment transitions, unknown inputs, conflicting instruments, missing sources and non-applicability cases pass.
7. Security and access: tenant/geography authorization, reviewer independence, immutable audit events and least privilege tested.
8. Evidence-backed integrations: external status is read from a tested authoritative integration or clearly recorded as manual/unconfirmed.
9. Release approval: change-controlled version, rollback/disable path, monitoring and named accountable approvers recorded.
10. Post-activation assurance: sampled decisions reconciled against the instrument and external evidence; defects trigger controlled disablement and correction.

Failure of any gate means the rule stays INACTIVE or RESEARCH_ONLY. There is no default-to-active behavior.

## 7. Current baseline disposition (2026-10-29)

The existing India source register is explicitly research-only, and unresolved source hashes/archive status are not evidence of completed archival. In particular, the SWM Rules 2026 full Gazette/source package, the 2026 plastic amendment, exact CCTS procedures/methodologies and dated BEE ACVA roster snapshots require artifact-level verification and review before rule activation. This document defines the gate; it does not claim those archives or approvals have been completed.

## 8. Acceptance checklist

- [ ] Every active source has an official source URL, exact artifact, SHA-256, retrieval time and immutable archive reference.
- [ ] Source versions and amendments have an explicit temporal chain.
- [ ] Applicability is persisted per actor/activity/period with reasons and evidence.
- [ ] No research-only or archive-pending source can activate a rule.
- [ ] EPR, ESG/BRSR and CCTS/CCC states are separate and not inferred from each other.
- [ ] Automated tests prove fail-closed behavior for missing hash, missing annexure, unknown applicability, superseded rules and unobserved external status.
- [ ] Independent legal/domain and engineering approvals are recorded.
- [ ] Production activation is separately approved; this document alone authorizes no deployment or statutory action.
