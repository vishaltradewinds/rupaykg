-- Settlement integrity: prevent duplicate active settlement records for the same credential/parties.
create unique index if not exists settlements_active_credential_party_uq
  on settlements(credential_id, payer_id, payee_id)
  where status not in ('SETTLED','CANCELLED');

-- Settlement references are externally reconciled identifiers and must be unique when present.
create unique index if not exists settlements_external_reference_uq
  on settlements(external_reference)
  where external_reference is not null and btrim(external_reference) <> '';
