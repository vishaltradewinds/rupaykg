-- Durable, transactionally locked head for the platform-admin hash-linked audit chain.
-- The row lock, rather than created_at or random UUID ordering, defines the authoritative append order.
create table if not exists platform_audit_chain_head (
  singleton boolean primary key default true check (singleton),
  last_event_id uuid,
  last_event_hash text,
  updated_at timestamptz not null default clock_timestamp(),
  constraint platform_audit_chain_head_hash_pair check (
    (last_event_id is null and last_event_hash is null)
    or (last_event_id is not null and last_event_hash is not null)
  )
);

-- Do not guess a chain head if pre-existing audit history is branched or disconnected.
do $
declare
  existing_events bigint;
  terminal_events bigint;
begin
  select count(*) into existing_events from audit_events;
  if existing_events > 0 then
    select count(*) into terminal_events
      from audit_events e
     where not exists (
       select 1 from audit_events successor
        where successor.previous_hash = e.event_hash
     );
    if terminal_events <> 1 then
      raise exception 'PLATFORM_AUDIT_CHAIN_RECONCILIATION_REQUIRED: expected exactly one terminal audit event, found %', terminal_events;
    end if;
  end if;
end;
$;

insert into platform_audit_chain_head(singleton, last_event_id, last_event_hash)
select true, e.id, e.event_hash
  from audit_events e
 where not exists (
   select 1 from audit_events successor
    where successor.previous_hash = e.event_hash
 )
 limit 1
on conflict (singleton) do nothing;

insert into platform_audit_chain_head(singleton)
select true
 where not exists (select 1 from platform_audit_chain_head where singleton=true)
on conflict (singleton) do nothing;
