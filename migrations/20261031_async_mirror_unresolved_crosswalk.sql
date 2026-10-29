-- Forward-only compatibility fix for the internal government inbox lifecycle.
-- UNRESOLVED means structurally valid intake lacks one unambiguous verified
-- jurisdiction crosswalk. It is not official acceptance/rejection or MRV approval.
-- This migration is intended for reviewed deployment through the standard runner;
-- do not apply manually to staging or production without release approval.

alter table async_mirror_inbox
  drop constraint if exists async_mirror_inbox_status_check;

alter table async_mirror_inbox
  add constraint async_mirror_inbox_status_check
  check (status in (
    'RECEIVED',
    'PROCESSING',
    'PROCESSED',
    'VALIDATED',
    'REJECTED',
    'RETRY',
    'QUARANTINED',
    'UNRESOLVED'
  ));

comment on column async_mirror_inbox.status is
  'Internal inbox lifecycle. UNRESOLVED means structurally valid intake lacks one unambiguous, currently valid, verified jurisdiction crosswalk; it is not official rejection or acceptance.';
