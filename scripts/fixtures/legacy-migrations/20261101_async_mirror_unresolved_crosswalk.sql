-- Planned corrective source recovered from feature branch; future-dated as of 2026-10-28. Not an applied/live migration.
-- Source blob 4f9776bc449025e795cb0d5c93e8bace9dea280b
alter table async_mirror_inbox drop constraint if exists async_mirror_inbox_status_check;
alter table async_mirror_inbox add constraint async_mirror_inbox_status_check
 check (status in ('RECEIVED','PROCESSING','PROCESSED','VALIDATED','REJECTED','RETRY','QUARANTINED','UNRESOLVED'));
comment on column async_mirror_inbox.status is 'Internal inbox lifecycle. UNRESOLVED means structurally valid intake lacks one unambiguous, currently valid, verified jurisdiction crosswalk; it is not official rejection or acceptance.';
