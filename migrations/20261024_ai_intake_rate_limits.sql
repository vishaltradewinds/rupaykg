-- Shared PostgreSQL-backed rate limit for AI evidence intake.
-- One identity/organization pair can attempt at most 10 intake requests per UTC/database minute.
-- No source text, prompt, model output, or credentials are stored in this table.
create table ai_intake_rate_limits (
  identity_id uuid not null references identities(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count between 1 and 10),
  primary key (identity_id, organization_id, window_start)
);

create index ai_intake_rate_limits_window_idx
  on ai_intake_rate_limits (window_start);

comment on table ai_intake_rate_limits is
  'Per-identity/per-organization fixed-window request counters for AI evidence intake; contains no source evidence or model output.';
