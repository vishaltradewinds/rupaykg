-- Preserve explicit provenance for field-device lifecycle mutations.
-- Enrollment and verification are security-sensitive administrative actions and
-- must remain attributable to the identity that performed them.

alter table field_devices
  add column if not exists registered_by_identity_id uuid references identities(id),
  add column if not exists registered_at timestamptz,
  add column if not exists verified_by_identity_id uuid references identities(id),
  add column if not exists verified_at timestamptz;

create index if not exists field_devices_registered_by_idx
  on field_devices(registered_by_identity_id, registered_at desc);
create index if not exists field_devices_verified_by_idx
  on field_devices(verified_by_identity_id, verified_at desc);
