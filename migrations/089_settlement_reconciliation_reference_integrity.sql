-- Settlement reconciliation evidence must be globally unique.
-- The confirmation route preflights duplicates, but concurrent requests must also
-- converge at the database boundary rather than allowing duplicate reconciliation evidence.

create unique index if not exists settlements_reconciliation_reference_uq
  on settlements(reconciliation_reference)
  where reconciliation_reference is not null and btrim(reconciliation_reference) <> '';
