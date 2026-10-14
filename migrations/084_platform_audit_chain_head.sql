-- Durable, transactionally locked head for platform-admin audit appends.
-- Existing audit rows are a migration-time anchor only: older writers do not all participate
-- in this chain. After cutover, platform-admin writes advance this head transactionally.
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

insert into platform_audit_chain_head(singleton, last_event_id, last_event_hash)
select true, e.id, e.event_hash
  from audit_events e
 order by e.created_at desc, e.id desc
 limit 1
on conflict (singleton) do nothing;

insert into platform_audit_chain_head(singleton)
select true
 where not exists (select 1 from platform_audit_chain_head where singleton=true)
   and not exists (select 1 from audit_events)
on conflict (singleton) do nothing;
