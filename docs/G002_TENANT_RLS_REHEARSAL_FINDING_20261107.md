# G-002 Tenant RLS Rehearsal Finding — 2026-11-07

## Rehearsal target

Neon project `rupaykg-production-fresh`, branch `rupaykg-tenant-isolation-lab-20261101` (`br-blue-tooth-b4kvuut7`).

## Observed baseline

- RLS-enabled public tables: 22.
- Public RLS policies: 88.
- Tenant policy model uses `app.current_organization_id()`.
- The function resolves `app.organization_id` from the current session.

## Controlled NOBYPASSRLS test

A dedicated rehearsal role `rupaykg_runtime_g002_test_20261107` was created as NOLOGIN/NOBYPASSRLS for the test and granted only the required schema/table privileges.

The role successfully became the current database role and successfully resolved:

`app.organization_id = 11111111-1111-4111-8111-111111111111`

However, an Org-A fixture activity was not visible to that role. The expected tenant-scoped SELECT returned zero rows.

## Determination

**Tenant A/B isolation proof: FAIL / NOT CLOSED.**

This is an important security finding. It prevents any claim that the current RLS design is production-ready or that G-002 tenant isolation has closed.

No production database mutation was performed.

## Required remediation

1. Reproduce the policy evaluation with a minimal role/function privilege matrix.
2. Determine why the NOBYPASSRLS role does not see the Org-A row under the matching tenant context.
3. Verify that required `app` schema/function grants are represented in authoritative migration history.
4. Re-run SELECT, INSERT, UPDATE and DELETE isolation tests for Org A versus Org B.
5. Only close the tenant-isolation gate after repeatable non-bypass runtime evidence passes.

Tracking issue: #325.
