#!/usr/bin/env bash
set -euo pipefail

DB_URL="$DATABASE_URL"
SCHEMA="shakti_concurrency_race"

cleanup() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<SQL
DROP SCHEMA IF EXISTS $SCHEMA CASCADE;
SQL
}
trap cleanup EXIT

psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<SQL
DROP SCHEMA IF EXISTS $SCHEMA CASCADE;
CREATE SCHEMA $SCHEMA;

CREATE TABLE $SCHEMA.organizations(id uuid PRIMARY KEY, status text NOT NULL);
CREATE TABLE $SCHEMA.memberships(
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES $SCHEMA.organizations(id),
  identity_id uuid NOT NULL,
  active boolean NOT NULL,
  can_settle boolean NOT NULL
);
CREATE TABLE $SCHEMA.geography_scopes(
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES $SCHEMA.organizations(id),
  active boolean NOT NULL
);
CREATE TABLE $SCHEMA.settlements(
  id uuid PRIMARY KEY,
  payer_org_id uuid NOT NULL REFERENCES $SCHEMA.organizations(id),
  payee_org_id uuid NOT NULL REFERENCES $SCHEMA.organizations(id),
  status text NOT NULL,
  geography_scope_id uuid REFERENCES $SCHEMA.geography_scopes(id)
);

INSERT INTO $SCHEMA.organizations VALUES
  ('00000000-0000-0000-0000-000000000001','VERIFIED'),
  ('00000000-0000-0000-0000-000000000002','VERIFIED');

INSERT INTO $SCHEMA.memberships VALUES
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000101',
   true, true);

INSERT INTO $SCHEMA.geography_scopes VALUES
  ('00000000-0000-0000-0000-000000000021',
   '00000000-0000-0000-0000-000000000001',
   true);

INSERT INTO $SCHEMA.settlements VALUES
  ('00000000-0000-0000-0000-000000000031',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   'OPEN',
   '00000000-0000-0000-0000-000000000021');

CREATE OR REPLACE FUNCTION $SCHEMA.authorize_settlement(expected_payee uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=pg_catalog,$SCHEMA
AS \$\$
DECLARE
  m $SCHEMA.memberships%ROWTYPE;
  o $SCHEMA.organizations%ROWTYPE;
  g $SCHEMA.geography_scopes%ROWTYPE;
  s $SCHEMA.settlements%ROWTYPE;
BEGIN
  SELECT * INTO o FROM $SCHEMA.organizations
   WHERE id='00000000-0000-0000-0000-000000000001' FOR UPDATE;
  SELECT * INTO m FROM $SCHEMA.memberships
   WHERE id='00000000-0000-0000-0000-000000000011' FOR UPDATE;
  SELECT * INTO g FROM $SCHEMA.geography_scopes
   WHERE id='00000000-0000-0000-0000-000000000021' FOR UPDATE;
  SELECT * INTO s FROM $SCHEMA.settlements
   WHERE id='00000000-0000-0000-0000-000000000031' FOR UPDATE;

  IF o.status <> 'VERIFIED' THEN RETURN 'DENY:organization_status'; END IF;
  IF NOT m.active OR NOT m.can_settle THEN RETURN 'DENY:membership_revoked'; END IF;
  IF NOT g.active THEN RETURN 'DENY:geography_invalid'; END IF;
  IF s.payee_org_id <> expected_payee THEN RETURN 'DENY:counterparty_changed'; END IF;
  IF s.status <> 'OPEN' THEN RETURN 'DENY:lifecycle_invalidated'; END IF;
  RETURN 'ALLOW';
END;
\$\$;
SQL

run_race() {
  case_name="$1"
  revocation_sql="$2"
  expected="$3"
  out_a="$(mktemp)"
  out_b="$(mktemp)"

  psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
    -c "BEGIN; $revocation_sql; SELECT pg_sleep(1); COMMIT;" \
    >"$out_b" 2>&1 &
  bpid=$!

  sleep 0.2

  psql "$DB_URL" -v ON_ERROR_STOP=1 -Atq \
    -c "BEGIN; SELECT $SCHEMA.authorize_settlement('00000000-0000-0000-0000-000000000002'); COMMIT;" \
    >"$out_a" 2>&1

  wait "$bpid"
  got="$(tail -n 1 "$out_a")"

  if [[ "$got" != "$expected" ]]; then
    echo "$case_name: FAIL expected=$expected got=$got"
    cat "$out_a" "$out_b"
    rm -f "$out_a" "$out_b"
    exit 1
  fi

  echo "$case_name: PASS -> $got"
  rm -f "$out_a" "$out_b"
}

run_race \
  "MEMBERSHIP_REVOCATION" \
  "UPDATE $SCHEMA.memberships SET active=false WHERE id='00000000-0000-0000-0000-000000000011'" \
  "DENY:membership_revoked"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
  -c "UPDATE $SCHEMA.memberships SET active=true WHERE id='00000000-0000-0000-0000-000000000011';"

run_race \
  "ORGANIZATION_SUSPENSION" \
  "UPDATE $SCHEMA.organizations SET status='SUSPENDED' WHERE id='00000000-0000-0000-0000-000000000001'" \
  "DENY:organization_status"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
  -c "UPDATE $SCHEMA.organizations SET status='VERIFIED' WHERE id='00000000-0000-0000-0000-000000000001';"

run_race \
  "GEOGRAPHY_REASSIGNMENT" \
  "UPDATE $SCHEMA.geography_scopes SET active=false WHERE id='00000000-0000-0000-0000-000000000021'" \
  "DENY:geography_invalid"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
  -c "UPDATE $SCHEMA.geography_scopes SET active=true WHERE id='00000000-0000-0000-0000-000000000021';"

run_race \
  "COUNTERPARTY_CHANGE" \
  "UPDATE $SCHEMA.settlements SET payee_org_id='00000000-0000-0000-0000-000000000001' WHERE id='00000000-0000-0000-0000-000000000031'" \
  "DENY:counterparty_changed"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
  -c "UPDATE $SCHEMA.settlements SET payee_org_id='00000000-0000-0000-0000-000000000002' WHERE id='00000000-0000-0000-0000-000000000031';"

run_race \
  "LIFECYCLE_INVALIDATION" \
  "UPDATE $SCHEMA.settlements SET status='CANCELLED' WHERE id='00000000-0000-0000-0000-000000000031'" \
  "DENY:lifecycle_invalidated"

echo "Shakti concrete multi-party concurrency race assurance: PASS"
