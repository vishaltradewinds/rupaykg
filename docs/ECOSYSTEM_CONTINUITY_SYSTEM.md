# RupayKg Ecosystem Continuity System

## Purpose

This repository uses a persistent execution checkpoint so work can resume across chats, machines and sessions without repeating completed work.

### Operating loop

**RECONCILE → IDENTIFY NEXT UNFINISHED ITEM → EXECUTE ONLY THAT ITEM → VERIFY → UPDATE CHECKPOINT**

`docs/ECOSYSTEM_STATE.json` is the checkpoint manifest.

## State meanings

- `VERIFIED_DONE` — current evidence exists; do not redo unless contradicted.
- `IN_PROGRESS` — actively being executed.
- `NEXT` — the next actionable unfinished item.
- `BLOCKED` — blocked by a concrete dependency; do not restart unrelated work.
- `UNVERIFIED` — implementation/evidence exists but current verification is missing.
- `NOT_STARTED` — downstream work intentionally waits for its prerequisites.

## Continuity rules

1. `vishaltradewinds/rupaykg` is the production source of truth.
2. `vishaltradewinds/rupaykg-aistudio` is reference-only.
3. Never redo a `VERIFIED_DONE` item merely because a new chat started.
4. Never treat historical evidence as current verification.
5. Never fabricate credentials, policy IDs, execution IDs, consensus timestamps, signatures or production acceptance.
6. Resolve the earliest actionable `NEXT` item before touching downstream work.
7. If a blocker affects only one item, continue independent work rather than restarting the ecosystem.
8. Update this checkpoint whenever a coherent state transition is actually verified.
9. Before declaring production readiness, require concrete evidence for every mandatory gate.
10. Chat/session changes do not reset project state.

## Current checkpoint

The active unfinished checkpoint is the **real published Guardian policy/workflow identifier** needed to bind the RupayKg WA03.001 acceptance flow. Once that is verified, continue sequentially through Guardian verification, Hedera consensus, persisted provenance and Mirror Node verification.

## Validation

Run:

```text
npm run ecosystem:reconcile
```

The validator checks the checkpoint structure, required states and repository identity, and reports the next actionable item. It does not mutate state or claim external verification that it cannot observe.
