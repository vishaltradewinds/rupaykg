-- Shakti Batch C: executable multi-party authorization assurance rehearsal.
-- VALIDATION ONLY. Disposable PostgreSQL only. Never execute against production.
\set ON_ERROR_STOP on

CREATE TEMP TABLE shakti_actor (
  identity_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  verified boolean NOT NULL,
  suspended boolean NOT NULL DEFAULT false,
  explicit_permission boolean NOT NULL,
  geography_verified boolean NOT NULL DEFAULT true
);

CREATE TEMP TABLE shakti_domain (
  table_name text PRIMARY KEY,
  id uuid NOT NULL,
  subject_org uuid,
  actor_org uuid,
  counterparty_org uuid,
  verified boolean NOT NULL DEFAULT true,
  geography_verified boolean NOT NULL DEFAULT true,
  lifecycle_valid boolean NOT NULL DEFAULT true,
  provenance_immutable boolean NOT NULL DEFAULT true
);

INSERT INTO shakti_actor VALUES
('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1',true,false,true,true),
('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b1',true,false,true,true),
('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1',false,false,true,true),
('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1',true,true,true,true),
('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1',true,false,false,true),
('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1',true,false,true,false);

INSERT INTO shakti_domain VALUES
('bwg_waste_reports','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true),
('chain_of_custody_links','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true),
('credentials','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true),
('epr_credit_allocations','10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true),
('epr_credit_transfers','10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true),
('epr_credits','10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true),
('registry_events','10000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true),
('settlements','10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true),
('settlement_events','10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1',true,true,true,true);

CREATE OR REPLACE FUNCTION pg_temp.shakti_domain_authorized(
  p_table text,
  p_actor uuid,
  p_operation text
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM shakti_actor a
    JOIN shakti_domain d ON d.table_name=p_table
    WHERE a.identity_id=p_actor
      AND a.verified
      AND NOT a.suspended
      AND a.explicit_permission
      AND a.geography_verified
      AND d.verified
      AND d.geography_verified
      AND d.lifecycle_valid
      AND d.provenance_immutable
      AND (
        (p_table='settlement_events' AND a.organization_id=d.actor_org)
        OR
        (p_table IN ('epr_credit_transfers','settlements') AND a.organization_id IN (d.actor_org,d.subject_org,d.counterparty_org))
        OR
        (p_table IN ('bwg_waste_reports','chain_of_custody_links','credentials','epr_credit_allocations','epr_credits','registry_events')
          AND a.organization_id=d.subject_org)
      )
      AND p_operation IN ('SELECT','INSERT','UPDATE')
  )
$$;

DO $assert$
DECLARE t text; good boolean;
BEGIN
  FOR t IN SELECT table_name FROM shakti_domain ORDER BY table_name LOOP
    SELECT pg_temp.shakti_domain_authorized(t,'00000000-0000-0000-0000-0000000000a1','SELECT') INTO good;
    IF good IS NOT TRUE THEN RAISE EXCEPTION 'Expected valid same-domain authorization for %',t; END IF;

    SELECT pg_temp.shakti_domain_authorized(t,'00000000-0000-0000-0000-0000000000b1','SELECT') INTO good;
    IF t IN ('epr_credit_transfers','settlements') THEN
      IF good IS NOT TRUE THEN
        RAISE EXCEPTION 'Expected explicit counterparty authorization for %',t;
      END IF;
    ELSE
      IF good IS TRUE THEN
        RAISE EXCEPTION 'Foreign organization unexpectedly authorized for %',t;
      END IF;
    END IF;

    IF pg_temp.shakti_domain_authorized(t,'00000000-0000-0000-0000-0000000000c1','SELECT') THEN
      RAISE EXCEPTION 'Unverified identity unexpectedly authorized for %',t;
    END IF;
    IF pg_temp.shakti_domain_authorized(t,'00000000-0000-0000-0000-0000000000d1','SELECT') THEN
      RAISE EXCEPTION 'Suspended identity unexpectedly authorized for %',t;
    END IF;
    IF pg_temp.shakti_domain_authorized(t,'00000000-0000-0000-0000-0000000000e1','SELECT') THEN
      RAISE EXCEPTION 'Missing explicit permission unexpectedly authorized for %',t;
    END IF;
    IF pg_temp.shakti_domain_authorized(t,'00000000-0000-0000-0000-0000000000f1','SELECT') THEN
      RAISE EXCEPTION 'Unverified geography unexpectedly authorized for %',t;
    END IF;
    IF pg_temp.shakti_domain_authorized(t,'00000000-0000-0000-0000-0000000000b1','DELETE') THEN
      RAISE EXCEPTION 'Foreign organization DELETE unexpectedly authorized for %',t;
    END IF;
  END LOOP;
END
$assert$;

UPDATE shakti_domain SET lifecycle_valid=false WHERE table_name='settlements';
DO $deny$
BEGIN
  IF pg_temp.shakti_domain_authorized('settlements','00000000-0000-0000-0000-0000000000a1','UPDATE') THEN
    RAISE EXCEPTION 'Lifecycle-invalid settlement unexpectedly authorized';
  END IF;
END
$deny$;

UPDATE shakti_domain SET lifecycle_valid=true, provenance_immutable=false WHERE table_name='registry_events';
DO $deny2$
BEGIN
  IF pg_temp.shakti_domain_authorized('registry_events','00000000-0000-0000-0000-0000000000a1','UPDATE') THEN
    RAISE EXCEPTION 'Mutable registry provenance unexpectedly authorized';
  END IF;
END
$deny2$;

UPDATE shakti_domain SET geography_verified=false WHERE table_name='chain_of_custody_links';
DO $deny3$
BEGIN
  IF pg_temp.shakti_domain_authorized('chain_of_custody_links','00000000-0000-0000-0000-0000000000a1','SELECT') THEN
    RAISE EXCEPTION 'Unverified chain-of-custody geography unexpectedly authorized';
  END IF;
END
$deny3$;

SELECT table_name, 'POSITIVE_SAME_DOMAIN_AND_NEGATIVE_FAIL_CLOSED' AS result
FROM shakti_domain ORDER BY table_name;
