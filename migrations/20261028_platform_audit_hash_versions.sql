-- Existing hashes were produced by historical writers with JSON.stringify order.
-- Preserve them as version 1; new canonical hashes are explicitly marked version 2.
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS hash_version smallint NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'audit_events_hash_version_check'
       AND conrelid = 'audit_events'::regclass
  ) THEN
    ALTER TABLE audit_events
      ADD CONSTRAINT audit_events_hash_version_check CHECK (hash_version IN (1, 2));
  END IF;
END $$;

COMMENT ON COLUMN audit_events.hash_version IS
  'Hash format version: 1=historical JSON.stringify writer; 2=canonical recursive JSON SHA-256, independently recomputable from stored fields.';
