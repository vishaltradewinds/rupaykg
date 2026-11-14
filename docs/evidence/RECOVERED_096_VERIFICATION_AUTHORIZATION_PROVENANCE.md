# Recovered production migration 096 — historical evidence only

- Original path: `migrations/096_verification_authorization_provenance.sql`
- Original commit: `ca8f4100782e13f8d72106187fafc8e1e446214f`
- Original Git blob SHA: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`
- Retrieved from the immutable historical commit on 2026-11-03.
- This file is stored under `docs/evidence/` deliberately; it is NOT an executable migration and must not be moved into the migration runner directory without a separately reviewed forward-only remediation decision.
- Production ledger evidence (read-only): `096_verification_authorization_provenance.sql` is recorded as applied. Do not replay it or rewrite the ledger.
- Security caveats from current production review: the legacy `verification_independence_guard` still has global-membership and role-name fallback behavior; authorization snapshots lack a separately verified immutability guard. This historical migration is therefore not, by itself, sufficient tenant-isolation assurance.
- No production database, role, trigger, function, schema, or deployment was changed by this evidence recovery.

## Original SQL

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


## Read-only production corroboration — 2026-11-03

Target: Neon project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`. All database observations below were SELECT-only; no DDL, DML, role, grant, or deployment action was performed.

### Historical source identity

- Retrieved `migrations/096_verification_authorization_provenance.sql` directly from original commit `ca8f4100782e13f8d72106187fafc8e1e446214f`.
- Git blob SHA returned by GitHub: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`, matching the blob recorded above.
- Original source path and SQL are preserved here as evidence only. Git's blob SHA is an immutable source-object identifier; it is not a SHA-256 execution checksum.

### Production ledger observation

Read-only query returned exactly one matching row:

| version | filename | applied_at |
|---|---|---|
| `096` | `096_verification_authorization_provenance.sql` | `2026-10-27T13:46:14.262Z` |

### Production catalog corroboration

Read-only catalog inspection confirmed all four columns exist on `public.verifications`:

- `authorization_membership_id uuid`
- `authorization_role_id uuid`
- `authorization_permissions_snapshot jsonb`
- `authorization_checked_at timestamptz`

It also confirmed trigger `verifications_integrity_guard` is a BEFORE INSERT OR UPDATE trigger on `public.verifications`, invoking `public.prevent_invalid_verification()`. The current database function body matches the material authorization logic preserved in this recovered source: activity/evidence binding, same-organization verified membership, active identity check, verifier permission check, and persisted authorization snapshot.

### Classification and limits

**Classification: `PROVEN_EXECUTION_CATALOG_ONLY` — not `PROVEN_EXACT_BYTES`.**

The matching ledger row, source Git object, expected columns, trigger, and function body strongly corroborate that migration 096's intended effect is present in production. However, no contemporaneous deployment artifact/job log or database audit record was located in this read-only investigation that binds the exact Git blob to the execution event at the recorded timestamp. Therefore exact historical execution bytes are not proven and this row is NOT eligible for checksum backfill under the recovery protocol.

### Remaining review items

- Locate immutable deployment/job evidence for the exact source commit/blob and target Neon branch at the recorded application time.
- Independently review the legacy `verification_independence_guard` behavior and whether authorization snapshot columns are protected from later mutation.
- Do not replay migration 096, restore it to the executable migration directory, alter the ledger, or synthesize a checksum.
- No production state was changed during this corroboration.


## Full live-ledger versus executable-migration inventory

A second read-only comparison was performed against the same Neon main branch and the migration directory at this evidence branch head:

- Neon `schema_migrations` rows: **92**.
- Executable `migrations/*.sql` files in the inspected repository branch: **91**.
- Ledger filenames with no matching executable migration file: **1** — `096_verification_authorization_provenance.sql`.
- Executable migration files absent from the live ledger: **0**.
- The sole unmatched ledger row is version `096`, applied at `2026-10-27T13:46:14.262Z`, and its original source object is preserved in this document's historical evidence record, not in the executable migration directory.

This explains why the source file must be preserved outside the runner directory: blindly restoring it as executable would risk replay, while leaving the legacy ledger unresolved blocks the checksum-aware runner. The correct path is a reviewed history/provenance reconciliation, not replay or ledger rewriting.

This comparison establishes filename inventory parity for the 91 currently present executable migrations and identifies one historical source recovery. It does not establish exact executed bytes for those 91 migrations, nor does it prove that their current file contents equal what was applied. Their historical classifications remain `UNRESOLVED` until release/deployment evidence is gathered.
