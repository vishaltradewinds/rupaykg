-- Each settlement lifecycle phase may have only one authoritative event.
-- The row state and append-only event trail must converge under retries/concurrency.

create unique index if not exists settlement_events_settlement_event_type_uq
  on settlement_events(settlement_id, event_type);
