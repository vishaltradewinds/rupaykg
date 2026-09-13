# RupayKg production target

RupayKG is India's circular-economy operating system for urban and rural resource flows. The production target is one authoritative national data model with geography-aware authorization, offline field capture, evidence-backed MRV, compliance, carbon accounting, environmental credentials, registry operations, governed settlement and reporting.

## Non-negotiable truth model

`LOCAL_CAPTURED -> SYNC_RECEIVED -> AUTHORITATIVE -> VERIFIED -> VALUE_ELIGIBLE -> CERTIFIED/ISSUED -> REGISTERED -> TRANSFERRED/RETIRED -> SETTLED -> REPORTED`

A local/offline record is not authoritative. Authoritative persistence is not verification. Verification is not financial settlement. The UI must expose these states distinctly.

## End-to-end lifecycle

`ONBOARD -> GENERATE -> AGGREGATE -> MEASURE -> TRANSPORT -> PROCESS -> EVIDENCE -> VERIFY -> COMPLIANCE/EPR -> CALCULATE VALUE -> CERTIFY/ISSUE -> REGISTRY -> TRANSFER/RETIRE -> SETTLE/RECONCILE -> ESG/REGULATORY REPORT`

Every value-bearing transition requires the appropriate upstream evidence, authorization and authoritative persistence.

## Guardian trust rail

Hedera Guardian is the external policy/MRV trust rail, not a replacement for the RupayKG operational system of record. The authoritative provenance chain is:

`ACTIVITY -> MEASUREMENT -> EVIDENCE -> VERIFICATION -> CALCULATION -> GUARDIAN POLICY/EVIDENCE RECORD -> HEDERA ANCHOR -> CREDENTIAL/CLAIM -> REGISTRY -> SETTLEMENT/REPORTING`

Guardian-bound submissions carry a RupayKG contract identifier, correlation ID and deterministic idempotency key. Provider responses must contain an authoritative execution identifier before a `VERIFIED` result can be accepted. Timeouts, malformed responses, unavailable credentials/providers and rejected workflows fail closed; the platform never fabricates Guardian execution IDs, policy decisions, Hedera transactions, consensus timestamps or credentials.

Guardian integration is therefore a separate external-trust state. A locally `VERIFIED` operational record must not be presented as Guardian-verified until the external provider actually returns the required authoritative result. Likewise, a Guardian result does not by itself constitute CPCB registration, EPR certificate issuance, regulator acceptance or financial settlement.

## Production configuration contract

Production startup uses `apps/src/production-server.ts` (compiled as `apps/dist/src/production-server.js`), not the development `server.ts` entrypoint directly. The production Fastify server also serves the built web application from `apps/web/dist`.

Startup fails closed unless all of the following are true:

- `NODE_ENV=production`.
- `DATABASE_URL` is a valid PostgreSQL URL and does not target localhost.
- `DATABASE_SSL=require`.
- `RUPAYKG_AUTH_MODE=real`.
- `RUPAYKG_ALLOWED_ORIGINS` contains one or more HTTPS origins with no path, query or fragment.
- `RUPAYKG_SYNTHETIC_DATA` is not enabled.
- `VITE_RUPAYKG_SESSION_TOKEN` is unset. A client-bundled session token is never a production credential.
- The authoritative Fastify server consumes the explicit `RUPAYKG_ALLOWED_ORIGINS` list directly. Reflective/permissive CORS is not a production policy.

The production entrypoint validates the configuration and passes the validated values to the authoritative server; it does not rely on source scanning to enforce CORS. Runtime CORS behavior is covered by an automated acceptance test.

The browser build additionally requires the four public Firebase web configuration values: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. Missing values fail the web build rather than producing an unauthenticated production bundle.

The checked-in `.env.example` documents the contract without containing production credentials. Production secrets and identity material must be supplied only by the deployment secret/configuration system.

## Offline operating contract

Field devices may capture activities, measurements, evidence and resource-flow events without connectivity. Each envelope carries a stable device identity, monotonic client sequence, capture timestamp and idempotency key. Synchronization is replay-safe and conflict-aware.

Offline clients must never:

- approve verification;
- declare regulatory compliance;
- issue or transfer a credential;
- claim carbon/EPR value as verified;
- mark money as settled; or
- bypass organization/geography authorization.

The server remains the source of truth. Conflicts remain explicit until resolved by an authorized workflow. Online and offline capture must converge on the same server-side lifecycle and authorization rules.

## Geography

The authoritative hierarchy supports India -> State/UT -> District -> Sub-district -> ULB or Gram Panchayat/cluster -> Ward/locality or village/cluster. Urban and rural operating workflows share the same underlying lifecycle while allowing different collection and processing patterns.

Organizations are expected to operate within configured geography scopes. No UI or API should infer authorization from a client-selected geography.

## Stakeholder operating model

The platform must support distinct permissions and dashboards for national/state/district administration, ULBs, Gram Panchayats, bulk waste generators, generators/producers/brand owners where applicable, collectors, transporters, processors/recyclers, MRV/verifiers, EPR/compliance teams, carbon/value teams, registry/settlement operators, auditors and enterprise ESG/reporting users. A stakeholder dashboard is a presentation of authoritative API state; it is not an independent source of truth.

## EPR/statutory boundary

RupayKG may prepare evidence, calculations, reconciliation and reporting data for statutory workflows and integrate with authoritative regulator processes where supported. Internal records must never be labelled as CPCB certificates, registrations, approvals, EPR credits, regulatory filings or regulator acceptance unless the authoritative external system actually issued or accepted that artifact. Plastic EPR records must remain traceable to the underlying activity, measurement, evidence, verification and applicable CPCB process.

## Settlement truth

Internal workflow state is never proof that funds moved. A settlement can become `SETTLED` only after an external settlement reference, external-authority confirmation timestamp and reconciliation reference are present. Confirmation data is retained and cannot be cleared.

## AI and reporting

AI findings are advisory and source-grounded. They cannot mutate authoritative operational state. Reports must distinguish authoritative, verified, pending, unavailable, simulated and demo information.

## UI/UX target

The operating UI is designed for national/state/district administration, ULBs, Gram Panchayats, field workers, generators, collectors, processors, MRV/verifiers, EPR/compliance teams, carbon teams, registry/settlement operators, auditors and enterprise reporting users. Desktop consoles and low-connectivity mobile workflows consume the same API contracts. External-trust state (Guardian/Hedera) must be visible separately from local verification and statutory status.

Google Stitch is used for design exploration and developer handoff through `DESIGN.md`; it is not treated as an authoritative backend or account integration.

## Definition of done

A production rollout is not complete until a clean environment can apply the ordered migrations and pass validation, the production entrypoint rejects incomplete/unsafe configuration, the production web build rejects missing Firebase configuration, an authorized user can execute the lifecycle, unauthorized users are denied, offline records synchronize safely, retries are idempotent, conflicts remain visible, value cannot bypass evidence/verification, Guardian integration is fail-closed and correlation/idempotency-safe, real Guardian and Hedera acceptance is verified separately, registry events are auditable, settlement cannot finalize without external confirmation/reconciliation, CORS is enforced by the actual Fastify runtime policy, and UI claims can be traced to authoritative state.
