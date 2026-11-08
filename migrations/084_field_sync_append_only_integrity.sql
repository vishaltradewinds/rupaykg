-- Field-sync evidence integrity hardening.
-- Processed envelopes are authoritative ingestion evidence and must be append-only.
-- Corrective migration: do not modify prior field-sync migrations after checksum enforcement.

create or replace function prevent_field_sync_envelope_mutation()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'field sync envelopes are immutable and append-only';
  end if;

  if tg_op = 'UPDATE'
     and old.status in ('APPLIED','REJECTED','CONFLICT')
     and (
       new.device_id is distinct from old.device_id
       or new.identity_id is distinct from old.identity_id
       or new.idempotency_key is distinct from old.idempotency_key
       or new.client_sequence is distinct from old.client_sequence
       or new.captured_at is distinct from old.captured_at
       or new.payload is distinct from old.payload
       or new.payload_hash is distinct from old.payload_hash
     ) then
    raise exception 'processed sync envelope provenance is append-only';
  end if;

  return new;
end;
$$;

drop trigger if exists field_sync_append_only_guard on field_sync_envelopes;
create trigger field_sync_append_only_guard
before update or delete on field_sync_envelopes
for each row execute function prevent_field_sync_envelope_mutation();
