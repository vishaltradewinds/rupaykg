-- Authoritative application metadata for field/offline envelopes.
-- An envelope is only marked APPLIED after its domain mutation commits in the same transaction.

alter table field_sync_envelopes
  add column if not exists applied_entity_type text,
  add column if not exists applied_entity_id uuid;

create index if not exists field_sync_applied_entity_idx
  on field_sync_envelopes(applied_entity_type, applied_entity_id)
  where applied_entity_id is not null;
