-- 110: Native email verification and password recovery.
-- Tokens are stored only as SHA-256 hashes and are single-use.
alter table identities
  add column if not exists email_verified_at timestamptz;

create table if not exists identity_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists identity_email_verification_active_idx
  on identity_email_verification_tokens(identity_id, expires_at desc)
  where consumed_at is null;

create table if not exists identity_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists identity_password_reset_active_idx
  on identity_password_reset_tokens(identity_id, expires_at desc)
  where consumed_at is null;

-- Existing accounts are deliberately not modified. The new email_verified_at
-- field is populated only through the explicit verification workflow.

-- Narrow runtime privileges for the identity operations performed by the
-- verification and password-reset endpoints. Column-level grants avoid
-- exposing unrelated identity, credential, or session fields.
grant select (id, email, status, suspended_at),
      update (status, email_verified_at)
  on identities to rupaykg_app_runtime;

grant select (identity_id),
      update (password_hash, password_salt, password_changed_at, failed_attempts, locked_until)
  on identity_password_credentials to rupaykg_app_runtime;

grant select (identity_id, revoked_at),
      update (revoked_at)
  on identity_sessions to rupaykg_app_runtime;

grant select, insert, update, delete
  on identity_email_verification_tokens, identity_password_reset_tokens
  to rupaykg_app_runtime;
