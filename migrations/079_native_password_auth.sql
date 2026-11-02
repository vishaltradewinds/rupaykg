-- Native RupayKg authentication credentials.
-- Passwords are never stored in plaintext. PostgreSQL remains authoritative.
create table if not exists identity_password_credentials (
  identity_id uuid primary key references identities(id) on delete cascade,
  password_hash text not null,
  password_salt text not null,
  password_algorithm text not null default 'scrypt',
  password_changed_at timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz
);

create index if not exists identity_password_locked_idx
  on identity_password_credentials(locked_until)
  where locked_until is not null;
