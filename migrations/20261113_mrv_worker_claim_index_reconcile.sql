-- Align the durable queue's partial claim index with the worker's exact
-- claimableStatuses allow-list. This migration does not change job eligibility.
-- The restricted claim function must still enforce the same allow-list itself.
drop index if exists mrv_submission_jobs_claim_idx;

create index mrv_submission_jobs_claim_idx
  on mrv_submission_jobs(next_attempt_at, created_at, id)
  where status in (
    'REQUESTED',
    'CLAIMED',
    'GUARDIAN_SUBMITTED',
    'GUARDIAN_VERIFIED',
    'HCS_SUBMITTED',
    'HCS_CONSENSUS_CONFIRMED',
    'MIRROR_VERIFIED',
    'RETRYABLE_FAILURE'
  );
