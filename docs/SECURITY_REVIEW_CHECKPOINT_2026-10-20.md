# RupayKg Security Review Checkpoint — 2026-10-20

## Scope and status
- Repository: `vishaltradewinds/rupaykg`
- Review branch: `intelligence/ai-evidence-intake-middleware`
- Starting reviewed commit: `1931ae20b7a52e760a3e166c7a536b7537f3f797`
- PR: [#41](https://github.com/vishaltradewinds/rupaykg/pull/41), still draft; do not merge or deploy based on this review alone.
- CI for starting commit: [run 39395151148](https://github.com/vishaltradewinds/rupaykg/actions/runs/39395151148) completed successfully, including dependency audit, migrations, typecheck, build, browser smoke test, PostgreSQL acceptance tests and production-container build.
- This is a targeted static review of the government inbox, AI evidence-intake route, auth/evidence persistence helpers and production configuration. It is not yet a full-repository penetration test or independent security certification.

## Findings (plain-language summary)

### S1 — High: Government inbox trusts a global shared HMAC secret, not a distinct authority identity
**Where:** `apps/src/async-mirror-routes.ts`, `RUPAYKG_GOV_BRIDGE_HMAC_SECRET`, `RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES`.

The request is authenticated using one configured secret and then checks whether the claimed `authorityCode` is in a global allow-list. If multiple external authorities share this same secret, any holder can submit data while claiming any allow-listed authority code. The allow-list does not bind a credential to a particular authority or municipality.

**Simple explanation:** A shared password proves “someone who knows the password sent this,” not “this exact government authority sent this.”

**Required fix:** Use a separate credential/key per authority (or a mutually authenticated identity), map that credential to exactly one authority and permitted municipal scope, support rotation/revocation, and test cross-authority impersonation. Keep all submissions non-authoritative until the source is formally onboarded and verified.

### S2 — High: AI intake has no visible request-level rate/concurrency limit or idempotency protection
**Where:** `apps/src/intelligence-routes.ts`, `POST /api/v1/intelligence/evidence-intake`.

The route can persist a source artifact up to 1 MiB and then call the configured model provider synchronously. There is no idempotency key or route-specific rate/concurrency control visible in this handler. An authorized but compromised or abusive account could repeatedly create evidence rows and trigger model spend/latency, consuming database storage, connections and provider capacity.

**Simple explanation:** One authorized account could keep submitting the same large log over and over and make the platform do costly work.

**Required fix:** Add per-identity and per-organization rate limits, bounded model-call concurrency and timeout, a stable idempotency key, storage quotas/retention policy, and monitoring. Verify the provider adapter's timeout and response-size enforcement as well.

### S3 — Medium: AI provider call happens after source storage but is synchronous and has no durable job/retry record
**Where:** `apps/src/intelligence-routes.ts`.

Source evidence is committed before inference. This correctly preserves the original, but if the request ends or the provider fails, the source remains captured and no durable job record in this route guarantees later retry or reconciliation. Repeated client retries can create duplicate source artifacts.

**Simple explanation:** The original note is saved, but if AI fails, the platform may not know automatically that it should try again—and retrying may create another copy.

**Required fix:** Create a durable extraction-job record tied to source evidence, with explicit states, idempotency, bounded retries, dead-letter/quarantine handling and an operator-visible reconciliation path. Do not change source evidence or create authoritative measurements automatically.

### S4 — Medium: Government batch hash depends on JSON property ordering, not canonical semantic content
**Where:** `apps/src/async-mirror-routes.ts`, `JSON.stringify(request.body)`.

The payload hash is calculated from the parsed request's JSON serialization. Two semantically identical JSON objects sent with different property order can produce different hashes. Reusing the same batch ID with reordered keys may therefore be rejected as changed content. The stored payload is normalized separately, so the hash is not a hash of exact original request bytes either.

**Simple explanation:** Two copies of the same information can look different to the duplicate detector just because fields are arranged in a different order.

**Required fix:** Define a documented canonical JSON encoding and hash that encoding, or retain/hash the exact raw body bytes and explicitly define replay semantics. Keep the HMAC verification and idempotency hash schemes clearly distinguished and tested.

### S5 — Medium: Timestamp validation is permissive for the sync-window field
**Where:** `apps/src/async-mirror-routes.ts`, `parseBatch()`.

`Date.parse()` accepts more date formats than a strict RFC 3339/ISO timestamp contract. The ±7-day check limits the time window, which is useful, but it does not enforce one unambiguous timestamp representation.

**Simple explanation:** The API says it accepts a timestamp, but does not strictly define the exact format, which can create integration inconsistencies.

**Required fix:** Require a strict timezone-bearing RFC 3339 format, validate calendar/time components, and test invalid dates, missing offsets and boundary timestamps.

### S6 — Medium: Production server should never be launched through the lower-level server entry point without validated config
**Where:** `apps/src/server.ts` and `apps/src/production-server.ts`.

The lower-level server defaults PostgreSQL TLS to `rejectUnauthorized: false` unless `DATABASE_SSL=false` or `DATABASE_SSL=require` is explicitly set. That setting encrypts a connection but does not verify the server certificate. The production entry point calls `readProductionConfig()` and sets `DATABASE_SSL=require` for external databases, so the validated production path is safer; however, launching `server.ts` directly could bypass that protection.

**Simple explanation:** Encryption without certificate verification is like a locked phone line that does not check whether the person on the other end is really the intended server.

**Required fix:** Make certificate verification the safe default, keep the explicit internal-Render exception narrowly scoped, and ensure all production start/deploy commands use the validated production entry point. Add a test that direct production startup cannot silently bypass TLS validation.

### S7 — Low/Medium: Test timestamps and environment mutation need stronger isolation
**Where:** `apps/src/gov-bridge-routes.test.ts`.

Some tests use a fixed October 19 timestamp while the current date is October 20; those tests exercise helper behavior with an injected clock, which is fine, but route tests should consistently use fresh signed timestamps. Several tests mutate process-wide environment variables, so concurrent tests could interfere if the test runner executes them in parallel.

**Simple explanation:** Tests can pass on one run and become flaky if the clock or test order changes.

**Required fix:** Use injected clocks where possible, restore environment variables in every path, and run these tests serially or isolate environment state.

## Existing good controls observed
- Government inbox uses HMAC-SHA256 with constant-time comparison, a short timestamp window, a minimum secret length, an authority-code allow-list, size/count/field limits and parameterized SQL.
- Duplicate batch IDs with different payload hashes return a conflict.
- Government inbox explicitly marks data as non-authoritative and reports no AI or Guardian action.
- AI intake checks authenticated identity, organization permission and geography scope before storing the source log.
- AI model output is strict-schema validated and stored separately from source evidence as an unverified proposal requiring human review.
- The route explicitly reports that no measurement, Guardian submission or carbon credit is created.
- Production configuration validates the environment, requires real auth mode, forbids synthetic data, validates HTTPS origins, and requires PostgreSQL TLS for external databases.

## Release gate
Do not merge or deploy based only on passing CI. Before production certification, close or formally risk-accept S1–S6; add tests for authority credential isolation, rate limits/idempotency, durable retries, canonical hashing, strict timestamps and TLS startup; then complete real Guardian/Hedera and official stakeholder integration verification. CI success is evidence of automated checks, not proof of security, government accreditation, MRV verification or carbon-credit issuance.

## Resume instruction
Continue from this checkpoint on `intelligence/ai-evidence-intake-middleware`, preserve `main`, keep PR #41 draft, and address the highest-risk finding first: authority-specific authentication and scope binding. Do not introduce real credentials or secrets into source control.
