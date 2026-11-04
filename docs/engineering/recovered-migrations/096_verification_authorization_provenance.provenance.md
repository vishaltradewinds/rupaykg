# Recovered migration source provenance — 096_verification_authorization_provenance.sql

Status: exact historical source preserved for evidence and review only. This file is outside the active migrations directory and must not be executed from this archive.

- Original migration path: migrations/096_verification_authorization_provenance.sql
- Historical source commit: ca8f4100782e13f8d72106187fafc8e1e446214f
- Git blob SHA: 258b1f4534efbf915688f78aa84d4ec24a47cbc0
- Removal commit: 54a7fe1ceb41b37a68720a71c10a1dd03af30dea
- Removal message: Remove accidentally placed unreviewed verification migration from main
- Authoritative production ledger row: version 096, filename 096_verification_authorization_provenance.sql, applied_at 2026-10-27T13:46:14.262Z
- Current production catalog has the four authorization snapshot columns and a prevent_invalid_verification function matching this recovered source.
- Production verifications currently has zero rows. No backfill was performed.
- Production ledger timestamp is later than the source-removal commit. Exact deployment artifact/build provenance has not been established; do not infer it.

The migration adds authorization_membership_id, authorization_role_id, authorization_permissions_snapshot and authorization_checked_at, then replaces prevent_invalid_verification and recreates verifications_integrity_guard. Review must assess same-organization authorization, identity suspension, legacy role-name trigger interaction, snapshot mutability and function ownership/search_path/grants.

Issue #214 tracks source/ledger reconciliation. Do not restore this file to the active migration directory, rewrite ledger rows, or replay it against production without independent DBA/security review and explicit founder approval.