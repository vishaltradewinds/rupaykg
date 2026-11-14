# Multi-Party Concrete Concurrency Race Assurance — 2026-11-06

## Status

Validation-only engineering evidence. This document does **not** establish production authorization, production RLS, production roles/grants/ownership, field acceptance, regulatory approval, certification, or TRL 9.

## Purpose

The earlier multi-party concurrency rehearsal established the fail-closed contract. This layer adds deterministic two-session PostgreSQL race tests so the contract is exercised with real row-lock contention rather than only static assertions.

## Disposable domain model

The rehearsal creates a disposable schema containing domain-shaped:

- organizations
- memberships
- geography_scopes
- settlements

The authorization function locks the authorization state in a deterministic order and evaluates the state after the competing transaction commits.

## Concrete race cases

1. Membership/permission revocation during authorization → DENY.
2. Organization suspension during authorization → DENY.
3. Geography scope removal/reassignment during authorization → DENY.
4. Settlement counterparty change during authorization → DENY.
5. Settlement lifecycle invalidation during authorization → DENY.

The competing transaction acquires the relevant row lock, changes the authorization state, holds the lock briefly, and commits. The decision transaction starts while the lock is held, waits for serialization, then evaluates the post-change state.

## Required interpretation

The test proves the disposable authorization primitive can resolve these races fail-closed under row-lock serialization.

It does **not** prove the live RupayKg application uses the same locking order or authorization function. Application/runtime integration and the nine production multi-party authorization implementations still require review and independent DBA/security assurance.

Production remains READ-ONLY/HOLD.
