# Government inbox worker module integration — 2026-10-31

## Scope

This draft adds the isolated government inbox worker module and its unit/real-PostgreSQL acceptance tests on top of migration-chain PR #156. It does not wire a scheduler, start a background process, add an HTTP trigger, or activate the worker in any environment.

## Restored source files

| File | Historical Git blob SHA |
|---|---|
| apps/src/async-mirror-worker.ts | 4597bf5c523a00637b5cf334faace100252fe985 |
| apps/src/government-inbox-hash.ts | 653b489ded2b5df9ada1524042ca8d452c587bc2 |
| apps/src/async-mirror-worker.test.ts | c1d12ea207fc95e9f9e42a28f63463467bdc3238 |
| apps/src/async-mirror-worker-db.test.ts | a465afb14a24e7f38a55d6959d1c2867978a7079 |

The worker implementation source includes the null-or-expired lease recovery correction and the matching read-only reconciliation predicate. The DB test uses synthetic fixtures only and requires `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` plus a disposable `DATABASE_URL`.

## Behaviour under test

- bounded claims using PostgreSQL `FOR UPDATE SKIP LOCKED`;
- per-claim lease tokens and fencing of stale worker completions;
- null/expired lease reclamation and attempts-exhausted quarantine;
- retry/backoff and deterministic rejection;
- canonical payload SHA-256 and timestamp binding;
- exact one-to-one, verified, effective-date/source-version crosswalk resolution;
- missing, ambiguous, expired, revoked and retired mappings remain internal `UNRESOLVED`;
- append-only, payload-free transition history;
- no official acceptance, authoritative MRV mutation, or Guardian/HCS submission.

## Review findings / cautions

- The worker module is intentionally not scheduled or started by the application.
- A successful internal `VALIDATED` result means structural and jurisdiction crosswalk checks only. It is not official acceptance, a verified MRV record, carbon-credit issuance, or external authority confirmation.
- The DB acceptance test provisions synthetic organizations, identities, geography, evidence-vault artifacts, source snapshots and crosswalk requests in the disposable database only.
- The worker's runtime schema depends on the full migration chain in parent PR #156. This is a stacked draft; do not merge this PR before #156 is independently reviewed and merged.
- The historical feature branch is not merged or cherry-picked.

## Required validation

1. Exact historical blob equality at this PR head.
2. Typecheck/build/unit tests.
3. Run the DB acceptance test in disposable PostgreSQL with zero skips and retain test output.
4. Review worker error paths, retry idempotency, event trigger coverage, lease race behaviour, query plans/indexes and data retention/privacy.
5. Confirm no route, scheduler, cron, or deployment starts the worker by default.
6. Independent security review before merge.

## Release posture

No live database writes/DDL, no merge, no deployment, no scheduler activation. Production HOLD. TRL 9 not established.


## Consolidated review branch

This PR is now retargeted directly to `main` and contains the complete 19-migration dependency chain from former draft PR #156 plus the four worker source/test files above. It is the single consolidated review path; the migration-only draft is superseded. The PR CI workflow runs on the consolidated exact head and includes disposable PostgreSQL acceptance tests with `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`.


## Additional lease-expiry hardening — 2026-10-31

Code review identified that completion updates previously fenced on status and lease token but did not independently require the lease to remain unexpired. A worker could therefore finish after its lease deadline if no replacement worker had yet changed the token. This is now hardened: all four success/unresolved/rejection/retry-or-quarantine completion updates require `lease_until > now()`. Expiry itself revokes completion authority; a later worker must reclaim with a fresh token.

The disposable PostgreSQL test now explicitly covers:
- recovery of a PROCESSING row with a NULL lease/token;
- an in-flight worker whose lease expires before completion, proving it cannot finalize;
- successful reclamation and completion by the next worker under a new lease;
- the existing superseded-token fencing case.

This is a conservative fail-closed correction. The exact-head CI run must pass again before the change is accepted. Independent review remains outstanding.


## Open security review item: source-snapshot jurisdiction scope

A follow-up source review found that source snapshots carry `scope_kind` and `scope_code`, and the regulatory-rule source gate (20261106) enforces compatible scope. However, the government crosswalk snapshot-binding trigger (20261105) currently verifies snapshot approval, authority code, source version and effective date, but does not enforce compatibility between the snapshot's jurisdiction scope and the target geography. The worker resolver likewise joins on snapshot approval/authority/version/effective dates but does not independently validate `scope_kind`/`scope_code`.

This is recorded as an OPEN design/security finding, not as an accepted behaviour. Before merge, an independent reviewer must decide and prove a deterministic scope-compatibility rule (including national, state/UT, district, local-body and OTHER cases) using the actual geography hierarchy and authoritative code crosswalks. Do not invent mappings or treat a broad snapshot as supporting a narrower jurisdiction without an explicit, reviewed rule. Until resolved, the worker PR remains draft and all live migration/activation gates remain closed.


### Authoritative directory reference for resolving this item

The Ministry of Panchayati Raj's Local Government Directory (LGD) is described by the Government of India's Open Government Data platform as the maintained directory of land/revenue regions and rural/urban local governments. The LGD catalog and local-body dataset are refreshed monthly; the local-body dataset exposes LGD codes. The Ministry's 17 May 2017 direction describes LGD as the standard location directory and requests adoption of LGD codes across government schemes and e-governance applications.

Design implication: use a versioned, evidence-backed mapping from the source snapshot's scope code to a platform geography node, with an explicit directory/source identity and effective period. A narrower source scope may support a target only where the target geography is demonstrably within that scope through a reviewed hierarchy. Do not derive jurisdiction from free-text names or assume that a municipality code, district code and local-body code are interchangeable.

References:
- Government of India OGD, Local Government Directory catalog: https://data.gov.in/catalog/local-government-directory-lgd
- Government of India OGD, LGD Local Bodies dataset (updated 28 October 2026): https://data.gov.in/resource/local-government-directory-lgd-local-bodies
- Ministry of Panchayati Raj direction on adoption of LGD codes (17 May 2017): https://mohua.gov.in/upload/whatsnew/59df106d75154ADOPTION_OF-LOCAL-GOVRNMENT-DIRECTORY-CODES-min.pdf

These sources establish the directory's role and code maintenance, not the correctness of any individual platform mapping. Every mapping still needs a source snapshot, evidence and authorized review.


## Source-scope implementation follow-up — 2026-10-31

The source-scope finding is now addressed in draft source by migration `20261110_government_source_scope_geography_binding.sql` and the worker resolver:
- snapshots with `INDIA` scope are national and carry no narrower scope code/node;
- `STATE_UT`, `DISTRICT`, and `LOCAL_BODY` scopes require an exact external code bound to a geography node and a checksum/version-verified `geography_sources` record named `Local Government Directory (LGD)`;
- the target geography must be that node or a descendant in the stored parent hierarchy;
- `OTHER` scope is exact-geography only;
- approved snapshot scope identity, geography code/hierarchy binding, and directory source provenance are immutable; source status revocation causes the resolver to fail closed;
- both crosswalk approval triggers and the worker resolver enforce the scope check.

The disposable PostgreSQL acceptance test now builds synthetic STATE_UT, DISTRICT and LOCAL_BODY scope nodes, verifies descendant coverage, rejects unrelated geography, and checks that approved scope/directory provenance cannot be rewritten. These are synthetic CI fixtures, not real LGD records.

The initial migration-only CI run failed because the old test fixture had not yet been updated for the new required scope fields. The fixture was updated in the next commit; a fresh exact-head CI run is required. This is an intentional fail-fast outcome, not a green gate. Independent security review must still inspect the scope model and actual LGD ingestion process before merge.


## Follow-up source-scope hierarchy expansion finding — 2026-10-31

A further adversarial review of migration 20261110 found that its immutability trigger froze existing scope nodes and descendants against UPDATE, but did not prevent a new geography INSERT beneath an approved scope or an existing unrelated node being reparented into that scope. Either operation could silently expand the set of geographies covered by an already approved source snapshot.

Fail-closed correction added in migration `20261111_prevent_approved_source_scope_hierarchy_expansion.sql`:
- rejects INSERT where the new parent is inside an approved/retired non-national source scope tree;
- rejects UPDATE that reparents an outside geography under that frozen tree;
- preserves the existing protection against changing/removing nodes already in the frozen tree;
- applies to descendants at every depth through a recursive, cycle-safe set.

The PostgreSQL acceptance test now exercises three attack paths for each synthetic administrative scope (STATE_UT, DISTRICT, LOCAL_BODY): adding a child under the scope root, reparenting an unrelated node into the scope, and adding a grandchild under an existing descendant. These must fail with `APPROVED_SOURCE_SCOPE_HIERARCHY_EXPANSION_FORBIDDEN`.

This is a source-code/migration correction only. It is not yet CI-verified. The migration must be included in the ordered disposable PostgreSQL run and the worker acceptance test must pass with zero skips before this finding can be closed. No live Neon changes were made.
