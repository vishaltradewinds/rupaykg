#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="$ROOT/docs/audit/evidence/recovered-staging-migrations"
DB_NAME="${RUPAYKG_RECOVERED_MIGRATIONS_DB:-rupaykg_recovered_migrations_test}"

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

declare -A EXPECTED_BLOBS=(
  [20261022_async_mirror_inbox.sql]=4d08607e03561b9fbb4ce502b4c4211127237050
  [20261023_async_mirror_worker_leases.sql]=33cb4d5d2e29a4a111340e5a0ac34170a0081895
  [20261024_ai_intake_rate_limits.sql]=87b51fe60a96a4e0752c8b0a9a170c81f9936dbb
  [20261025_ai_evidence_intake_jobs.sql]=6a0ae54530b7b756dac33589eaf18df3b071d8f2
)

for name in "${!EXPECTED_BLOBS[@]}"; do
  file="$EVIDENCE_DIR/$name.recovered.sql"
  actual="$(git hash-object "$file")"
  expected="${EXPECTED_BLOBS[$name]}"
  if [[ "$actual" != "$expected" ]]; then
    echo "Git blob mismatch for $name: expected $expected, got $actual" >&2
    exit 1
  fi
  echo "Exact source blob verified: $name ($actual)"
done

# This database is created only inside the ephemeral GitHub Actions PostgreSQL service.
createdb "$DB_NAME"

psql --dbname="$DB_NAME" --set=ON_ERROR_STOP=1 <<'SQL'
create table public.identities (id uuid primary key);
create table public.organizations (id uuid primary key);
create table public.evidence (id uuid primary key);
SQL

for name in \
  20261022_async_mirror_inbox.sql \
  20261023_async_mirror_worker_leases.sql \
  20261024_ai_intake_rate_limits.sql \
  20261025_ai_evidence_intake_jobs.sql
do
  echo "Applying recovered archival source to disposable database: $name"
  psql --dbname="$DB_NAME" --set=ON_ERROR_STOP=1 \
    --file="$EVIDENCE_DIR/$name.recovered.sql"
done

psql --dbname="$DB_NAME" --set=ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  identity_id uuid := gen_random_uuid();
  organization_id uuid := gen_random_uuid();
  evidence_id uuid := gen_random_uuid();
  inbox_id uuid;
  blocked boolean;
  event_count integer;
begin
  insert into identities(id) values (identity_id);
  insert into organizations(id) values (organization_id);
  insert into evidence(id) values (evidence_id);

  insert into async_mirror_inbox
    (authority_code, municipal_code, batch_id, sync_window_timestamp, payload, payload_sha256)
  values
    ('TEST-AUTH', 'TEST-MUNI', gen_random_uuid(), now(),
     '{"batchMetadata":{"sourceVersion":"test-v1"},"rawDataLogs":["synthetic test payload"]}'::jsonb,
     repeat('a', 64))
  returning id into inbox_id;

  select count(*) into event_count
    from async_mirror_inbox_events where inbox_id = inbox_id;
  if event_count <> 1 then
    raise exception 'expected one INSERT event, got %', event_count;
  end if;

  update async_mirror_inbox
     set status = 'PROCESSING', attempts = 1, lease_token = gen_random_uuid(), lease_until = now() + interval '2 minutes'
   where id = inbox_id;

  select count(*) into event_count
    from async_mirror_inbox_events where inbox_id = inbox_id;
  if event_count <> 2 then
    raise exception 'expected a second status/attempt event, got %', event_count;
  end if;

  update async_mirror_inbox set status = 'VALIDATED' where id = inbox_id;

  blocked := false;
  begin
    update async_mirror_inbox_events
       set error_code = 'tamper'
     where inbox_id = inbox_id;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'append-only event UPDATE was not blocked';
  end if;

  blocked := false;
  begin
    delete from async_mirror_inbox_events where inbox_id = inbox_id;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'append-only event DELETE was not blocked';
  end if;

  blocked := false;
  begin
    insert into async_mirror_inbox
      (authority_code, municipal_code, batch_id, sync_window_timestamp, payload, payload_sha256, status)
    values
      ('TEST-AUTH', 'TEST-MUNI', gen_random_uuid(), now(), '{}'::jsonb, repeat('b', 64), 'UNRESOLVED');
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'UNRESOLVED unexpectedly accepted by 20261022/20261023 migrations; it belongs to later crosswalk migration';
  end if;

  insert into ai_intake_rate_limits(identity_id, organization_id, window_start, request_count)
  values(identity_id, organization_id, date_trunc('minute', now()), 10);

  blocked := false;
  begin
    insert into ai_intake_rate_limits(identity_id, organization_id, window_start, request_count)
    values(identity_id, organization_id, date_trunc('minute', now()) + interval '1 minute', 11);
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'AI intake rate limit accepted request_count > 10';
  end if;

  insert into ai_evidence_intake_jobs
    (identity_id, organization_id, idempotency_key, request_sha256)
  values(identity_id, organization_id, 'test-idempotency-key', repeat('c', 64));

  blocked := false;
  begin
    insert into ai_evidence_intake_jobs
      (identity_id, organization_id, idempotency_key, request_sha256)
    values(identity_id, organization_id, 'test-idempotency-key', repeat('c', 64));
  exception when unique_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'AI intake idempotency uniqueness was not enforced';
  end if;

  blocked := false;
  begin
    update ai_evidence_intake_jobs
       set status = 'COMPLETED', completed_at = now()
     where identity_id = identity_id and organization_id = organization_id;
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'completed AI intake job without response_json was accepted';
  end if;

  update ai_evidence_intake_jobs
     set status = 'COMPLETED', completed_at = now(), response_json = '{"ok":true}'::jsonb
   where identity_id = identity_id and organization_id = organization_id;

  if to_regclass('public.async_mirror_inbox_due_idx') is null
     or to_regclass('public.async_mirror_inbox_expired_lease_idx') is null
     or to_regclass('public.ai_evidence_intake_jobs_recovery_idx') is null
     or to_regclass('public.ai_evidence_intake_jobs_org_updated_idx') is null then
    raise exception 'expected recovery indexes are missing';
  end if;
end;
$$;

select 'recovered staging migration validation: PASS' as result;
SQL

echo "Recovered staging migration validation completed successfully."
