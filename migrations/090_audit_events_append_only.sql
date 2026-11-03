-- Protect persisted audit history from accidental UPDATE, DELETE, or TRUNCATE.
-- Canonical appends remain INSERT-only through append_platform_audit_event().
-- This is a database integrity control, not protection against a database superuser
-- deliberately disabling triggers or rewriting the database outside normal operation.

create or replace function reject_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events are append-only'
    using errcode = '55000';
end;
$$;

create or replace function reject_audit_event_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events are append-only'
    using errcode = '55000';
end;
$$;

drop trigger if exists audit_events_append_only_row on audit_events;
create trigger audit_events_append_only_row
before update or delete on audit_events
for each row
execute function reject_audit_event_mutation();

drop trigger if exists audit_events_no_truncate on audit_events;
create trigger audit_events_no_truncate
before truncate on audit_events
for each statement
execute function reject_audit_event_truncate();
