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

-- Initialize only when there is exactly one terminal event. A branched/disconnected
-- history leaves the head absent, so platform-admin audit writes fail closed until reconciled.
insert into platform_audit_chain_head(singleton, last_event_id, last_event_hash)
select true, e.id, e.event_hash
  from audit_events e
 where not exists (
   select 1 from audit_events successor
    where successor.previous_hash = e.event_hash
 )
   and (select count(*) from audit_events terminal
         where not exists (
           select 1 from audit_events successor
            where successor.previous_hash = terminal.event_hash
         )) = 1
 limit 1
on conflict (singleton) do nothing;

insert into platform_audit_chain_head(singleton)
select true
 where not exists (select 1 from platform_audit_chain_head where singleton=true)
   and not exists (select 1 from audit_events)
on conflict (singleton) do nothing;
