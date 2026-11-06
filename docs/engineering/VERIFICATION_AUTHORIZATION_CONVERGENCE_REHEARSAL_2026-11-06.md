# Verification authorization convergence rehearsal — 2026-11-06

## Scope

Disposable PostgreSQL rehearsal only. It combines the security semantics of:

- #252 — organization-to-role tenant binding.
- #251 — corrected fail-closed geography fixture/implementation.
- #272 — canonical verification guard owner and trigger baseline.
- #284 — authenticated, transaction-local signed bearer context and append-only verification semantics.
- #268 — migrator/API startup separation remains the execution boundary; this rehearsal does not alter production startup or credentials.

## Convergence decision

PR #284's separate `rupaykg_auth_context_owner` is **not** retained as a second security-definer owner.

The rehearsal ports the authenticated-context primitives into the canonical `rupaykg_verification_guard` owner established by #272. This produces one authoritative verification security-definer owner and one authoritative verification authorization trigger, while preserving the signed transaction-local context model.

PR #247's competing verification trigger is historical evidence only and is not applied.

## Assertions

1. membership role ownership is tenant-bound;
2. geography authorization is fail-closed when no verified scope exists;
3. the verification guard is SECURITY DEFINER, NOBYPASSRLS, NOLOGIN and owned by the canonical guard role;
4. the authenticated context issuer and verification trigger share the same canonical owner;
5. the private HMAC key is inaccessible through PUBLIC privileges;
6. role-name fallback (`VERIFIER`/`AUDITOR`) is absent from the converged verification function;
7. legacy verification triggers are removed;
8. verification INSERT/UPDATE, DELETE and TRUNCATE are covered by the authoritative append-only guard set;
9. unauthenticated/unsigned transaction context fails closed.

## Explicit limitation

This rehearsal is **not** a production migration and does not prove live Neon role provisioning, production RLS, runtime grants, Render configuration, field acceptance, regulatory approval, Guardian/Hedera acceptance, or TRL 9.

The next gate is exact-head CI on this rehearsal branch, followed by independent DBA/security review. No merge/deploy is authorized by this rehearsal.