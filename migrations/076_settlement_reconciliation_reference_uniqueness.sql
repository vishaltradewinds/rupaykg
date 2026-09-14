-- External reconciliation references identify a single authoritative settlement.
-- Keep the database constraint as the concurrency-safe defense in depth for the API preflight.
create unique index if not exists settlements_reconciliation_reference_uq
  on settlements(reconciliation_reference)
  where reconciliation_reference is not null and btrim(reconciliation_reference) <> '';
