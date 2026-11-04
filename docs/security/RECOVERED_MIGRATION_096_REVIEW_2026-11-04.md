# Recovered migration 096 — immutable source evidence and security review

**Review date:** 2026-11-04  
**Repository:** `vishaltradewinds/rupaykg`  
**Original introduction:** commit `ca8f4100782e13f8d72106187fafc8e1e446214f`  
**Removal:** commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`  
**Original Git blob:** `258b1f4534efbf915688f78aa84d4ec24a47cbc0`  
**Production ledger:** records `096_verification_authorization_provenance.sql`  
**Disposition:** recovered for review only; NOT restored to active migrations and NOT authorized for replay.

## Why this record exists

Production's migration ledger records migration 096, but current `main` does not contain its SQL file. Git history shows the migration was introduced and subsequently removed with the commit message “Remove accidentally placed unreviewed verification migration from main”. The exact SQL below is preserved as historical evidence, not as an instruction to apply it.

## Exact recovered SQL

```sql
-- Bind approved verification to the verifier's active permission in the same
-- organization as the activity, and retain the decision-time authorization snapshot.
alter table verifications
  add column if not exists authorization_membership_id uuid references organization_memberships(id),
  add column if not exists authorization_role_id uuid references roles(id),
  add column if not exists authorization_permissions_snapshot jsonb,
  add column if not exists authorization_checked_at timestamptz;

create or replace function prevent_invalid_verification()
returns trigger
language plpgsql
as $$
declare
  resolved_activity_id uuid;
  activity_actor uuid;
  activity_organization_id uuid;
  membership_row record;
  evidence_activity_id uuid;
begin
  resolved_activity_id := new.activity_id;

  if new.evidence_id is not null then
    select e.activity_id into evidence_activity_id
    from evidence e where e.id = new.evidence_id;

    if evidence_activity_id is null then
      raise exception 'verification evidence must be bound to an activity';
    end if;

    if resolved_activity_id is not null and resolved_activity_id is distinct from evidence_activity_id then
      raise exception 'verification activity must match the evidence activity';
    end if;

    resolved_activity_id := evidence_activity_id;
    new.activity_id := evidence_activity_id;
  end if;

  if resolved_activity_id is not null then
    select a.actor_identity_id, a.organization_id
      into activity_actor, activity_organization_id
    from activities a where a.id = resolved_activity_id;
  end if;

  if new.decision = 'APPROVED' then
    if activity_organization_id is null then
      raise exception 'approved verification requires an activity with an organization';
    end if;

    if activity_actor is not null and activity_actor = new.verifier_identity_id then
      raise exception 'activity actor cannot verify its own evidence';
    end if;

    select m.id as membership_id, m.role_id, r.permissions
      into membership_row
    from organization_memberships m
    join roles r on r.id = m.role_id
    join identities i on i.id = m.identity_id
    where m.identity_id = new.verifier_identity_id
      and m.organization_id = activity_organization_id
      and m.status = 'VERIFIED'
      and i.status = 'VERIFIED'
      and i.suspended_at is null
      and (
        r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
        or r.permissions @> '["verification:approve"]'::jsonb
        or r.permissions @> '["verification.approve"]'::jsonb
      )
    order by m.created_at desc
    limit 1;

    if membership_row.membership_id is null then
      raise exception 'approved verification requires active verifier permission in the activity organization';
    end if;

    new.authorization_membership_id := membership_row.membership_id;
    new.authorization_role_id := membership_row.role_id;
    new.authorization_permissions_snapshot := membership_row.permissions;
    new.authorization_checked_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists verifications_integrity_guard on verifications;
create trigger verifications_integrity_guard
before insert or update on verifications
for each row execute function prevent_invalid_verification();

comment on column verifications.authorization_membership_id is
  'Verified organization membership used when this verification was approved.';
comment on column verifications.authorization_role_id is
  'Role used for the decision-time verifier authorization snapshot.';
comment on column verifications.authorization_permissions_snapshot is
  'Permissions JSON copied from the verifier role at decision time; later role changes do not rewrite historical provenance.';
comment on column verifications.authorization_checked_at is
  'Database timestamp when verifier authorization was checked for an approved decision.';
```

## What production inspection confirms

A read-only query on 2026-11-04 confirmed:
- all four `authorization_*` columns exist on `public.verifications`;
- `verifications_integrity_guard` invokes `prevent_invalid_verification()`;
- the live function body matches the recovered SQL logic;
- the separate `verification_independence_guard` remains active on INSERT and still accepts legacy role names `VERIFIER` / `AUDITOR` as an alternative to explicit permission;
- production `verifications` had zero rows at the time of the earlier issue #214 inspection; current row count must be rechecked before any data migration or backfill design.

No production write, DDL or migration was performed.

## Security review — unresolved defects and design questions

1. **Snapshot mutability:** the trigger fires on every UPDATE. For an APPROVED row it recomputes and overwrites the authorization snapshot; the SQL does not preserve the original decision-time snapshot or reject changes to the snapshot columns. The column comments claim later role changes do not rewrite history, but the trigger does not enforce that claim.
2. **Decision downgrade / re-approval semantics:** when a row is updated from APPROVED to another decision, the function does not clear or freeze the old snapshot. A later update back to APPROVED will recompute it. The state-transition contract must be explicit.
3. **Multiple memberships:** selection is by latest `created_at` only. It does not define deterministic tie-breaking and does not prove the chosen membership is the exact membership used by the application request.
4. **Legacy trigger conflict:** `verification_independence_guard` allows `VERIFIER` / `AUDITOR` role-name fallback. This contradicts the explicit-permission rule in migration 027 and the stricter same-organization guard in 096. Do not drop it until its self-approval protection and any other intended invariants have been merged into one authoritative trigger/function and regression-tested.
5. **Permission snapshot meaning:** copying the entire role permissions JSON is not necessarily a minimal proof of the specific permission used. Consider storing the exact permission code, membership/role IDs, subject organization, decision timestamp, and a canonical digest, while preserving the immutable source values.
6. **Trigger ordering:** PostgreSQL fires same-event triggers alphabetically by trigger name. The two current BEFORE INSERT triggers therefore have an ordering relationship; do not assume their checks compose in the intended order without an explicit unified trigger and tests.
7. **Privilege model:** the production table owner/runtime role is currently privileged and BYPASSRLS-capable. Trigger logic is not a substitute for least-privilege runtime separation, tenant RLS or independently tested DB authorization.

## Required forward-only remediation design

- Preserve this file as immutable historical evidence. Do not reintroduce migration 096 under its old number and do not replay it.
- Recover deployment/build provenance and compare source checksum, live function definition, trigger definitions and ledger timestamp.
- Design one authoritative verification guard that:
  - resolves the evidence/activity/organization tuple;
  - requires an active, non-suspended identity and verified membership in the activity's organization;
  - requires explicit verification permission, never role-name fallback;
  - rejects self-approval;
  - records a deterministic, decision-time authorization snapshot exactly once;
  - prevents mutation, clearing, reassignment or silent recomputation of that snapshot after approval;
  - defines allowed verification decision transitions and re-approval behaviour;
  - is safe under concurrent membership/role revocation and transaction isolation;
  - runs with reviewed privileges and a fixed safe search path where required.
- Add disposable PostgreSQL tests for cross-org membership, suspended identity, revoked membership, permission removal, role-name-only verifier, self-approval, mismatched evidence/activity, duplicate memberships, concurrent revocation, approved-row update, decision downgrade/re-approval, snapshot tampering and trigger-order independence.
- Run tests under the intended non-owner runtime role, not the table owner.
- Only after independent DBA/security review, create a new forward-only migration with a new unique version and rehearse it on a disposable clone. Production remains READ-ONLY / HOLD until explicit approval.

## Release decision

This recovered source is **not production-approved**. It does not establish regulatory acceptance, verifier independence certification, production readiness or TRL 9.
