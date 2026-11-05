#!/usr/bin/env bash
set -euo pipefail

# Disposable CI concurrency rehearsal for the verification/geography lock-order
# boundary. It proves that a concurrent geography-scope revocation cannot race
# past the organization lock used by verification authorization.
#
# A holds the organization row lock while changing the scope to PENDING.
# B attempts verification approval against the same organization.
# Expected: B blocks behind A, then succeeds only after A rolls back.
#
# This is a lock-order rehearsal, not production certification.

: "\${DATABASE_URL:?DATABASE_URL is required}"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

setup_sql="$workdir/setup.sql"
revoker_sql="$workdir/revoker.sql"
verifier_sql="$workdir/verifier.sql"
out_a="$workdir/revoker.out"
out_b="$workdir/verifier.out"

cat >"$setup_sql" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.organizations(name,organization_type,status)
VALUES ('CI-LOCK-REHEARSAL-ORG','test_fixture','VERIFIED'::record_status)
RETURNING id \gset org_

INSERT INTO public.geography(kind,name,source,source_version)
VALUES ('STATE_UT','CI-LOCK-REHEARSAL-GEO','ci-lock-rehearsal','v1')
RETURNING id \gset geo_

INSERT INTO public.identities(external_subject,display_name,status)
VALUES ('ci-lock-rehearsal-verifier','CI Lock Rehearsal Verifier','VERIFIED'::record_status)
RETURNING id \gset verifier_

INSERT INTO public.identities(external_subject,display_name,status)
VALUES ('ci-lock-rehearsal-actor','CI Lock Rehearsal Actor','VERIFIED'::record_status)
RETURNING id \gset actor_

INSERT INTO public.roles(organization_id,name,permissions,geography_scope)
VALUES (:'org_id','ci_lock_rehearsal_verifier','["VERIFY_EVIDENCE"]'::jsonb,'[]'::jsonb)
RETURNING id \gset role_

ALTER TABLE public.organization_memberships
  DISABLE TRIGGER stakeholder_membership_application_guard;

INSERT INTO public.organization_memberships(identity_id,organization_id,role_id,status)
VALUES (:'verifier_id',:'org_id',:'role_id','VERIFIED'::record_status)
RETURNING id \gset membership_

ALTER TABLE public.organization_memberships
  ENABLE TRIGGER stakeholder_membership_application_guard;

INSERT INTO public.organization_geography_scopes(organization_id,geography_id,status)
VALUES (:'org_id',:'geo_id','VERIFIED'::record_status);

INSERT INTO public.identity_sessions(identity_id,expires_at,token_hash)
VALUES (
  :'verifier_id',
  clock_timestamp()+interval '10 minutes',
  encode(public.digest(convert_to('ci-lock-rehearsal-valid-token','UTF8'),'sha256'),'hex')
);

INSERT INTO public.activities(organization_id,actor_identity_id,geography_id,activity_type,status)
VALUES (:'org_id',:'actor_id',:'geo_id','CI_LOCK_REHEARSAL_ACTIVITY','COMPLETED')
RETURNING id \gset activity_

INSERT INTO public.evidence(activity_id,evidence_type,status,captured_at,content_hash)
VALUES (:'activity_id','CI_LOCK_REHEARSAL_EVIDENCE','UNDER_REVIEW'::evidence_status,
        clock_timestamp(),repeat('c',64))
RETURNING id \gset evidence_

COMMIT;

\echo "org_id=:'org_id'"
\echo "geo_id=:'geo_id'"
\echo "verifier_id=:'verifier_id'"
\echo "evidence_id=:'evidence_id'"
SQL

psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --file="$setup_sql" >"$workdir/setup.out"

org_id="$(sed -n 's/^org_id=//p' "$workdir/setup.out" | tail -1)"
geo_id="$(sed -n 's/^geo_id=//p' "$workdir/setup.out" | tail -1)"
verifier_id="$(sed -n 's/^verifier_id=//p' "$workdir/setup.out" | tail -1)"
evidence_id="$(sed -n 's/^evidence_id=//p' "$workdir/setup.out" | tail -1)"

test -n "$org_id"
test -n "$geo_id"
test -n "$verifier_id"
test -n "$evidence_id"

cat >"$revoker_sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
UPDATE public.organization_geography_scopes
   SET status='PENDING'::record_status
 WHERE organization_id='$org_id'::uuid
   AND geography_id='$geo_id'::uuid;
SELECT pg_sleep(3);
ROLLBACK;
SQL

cat >"$verifier_sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
SELECT public.rupaykg_set_authenticated_context(
  'ci-lock-rehearsal-valid-token',
  '$org_id'::uuid
);
INSERT INTO public.verifications(
  evidence_id,activity_id,verifier_identity_id,decision,scope,rationale
)
SELECT
  '$evidence_id'::uuid,
  e.activity_id,
  '$verifier_id'::uuid,
  'APPROVED',
  'CI_LOCK_REHEARSAL',
  'concurrency lock-order rehearsal'
FROM public.evidence e
WHERE e.id='$evidence_id'::uuid;
COMMIT;
SQL

start_ns="$(date +%s%N)"
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --file="$revoker_sql" >"$out_a" 2>&1 &
pid_a=$!

sleep 0.5
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --file="$verifier_sql" >"$out_b" 2>&1 &
pid_b=$!

wait "$pid_a"
wait "$pid_b"
end_ns="$(date +%s%N)"

elapsed_ms="$(( (end_ns - start_ns) / 1000000 ))"

# The verifier must have waited for the revoker's organization lock. With a
# three-second hold and a 0.5s stagger, completion below 2.0s would indicate
# that the expected serialization boundary was not exercised.
if (( elapsed_ms < 2000 )); then
  echo "FAIL: verification completed too quickly (${elapsed_ms}ms); expected organization-lock serialization"
  cat "$out_a"
  cat "$out_b"
  exit 1
fi

psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 <<SQL
\set ON_ERROR_STOP on
DO \$assert\$
DECLARE
  scope_status text;
  verification_count integer;
BEGIN
  SELECT s.status::text INTO scope_status
    FROM public.organization_geography_scopes s
   WHERE s.organization_id='$org_id'::uuid
     AND s.geography_id='$geo_id'::uuid;

  SELECT count(*) INTO verification_count
    FROM public.verifications
   WHERE evidence_id='$evidence_id'::uuid
     AND scope='CI_LOCK_REHEARSAL';

  IF scope_status <> 'VERIFIED' OR verification_count <> 1 THEN
    RAISE EXCEPTION
      'concurrency rehearsal failed: scope_status=%, verification_count=%',
      scope_status, verification_count;
  END IF;
END
\$assert\$;
SQL

echo "PASS: geography revocation and verification approval serialized on the organization lock (${elapsed_ms}ms)."
