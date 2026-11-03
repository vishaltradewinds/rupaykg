-- Recovered source: intelligence/ai-evidence-intake-middleware @ c56b9c1; blob 87b51fe60a96a4e0752c8b0a9a170c81f9936dbb
create table ai_intake_rate_limits (
 identity_id uuid not null references identities(id) on delete cascade,
 organization_id uuid not null references organizations(id) on delete cascade,
 window_start timestamptz not null,
 request_count integer not null check (request_count between 1 and 10),
 primary key(identity_id,organization_id,window_start)
);
create index ai_intake_rate_limits_window_idx on ai_intake_rate_limits(window_start);
comment on table ai_intake_rate_limits is 'Per-identity/per-organization fixed-window request counters for AI evidence intake; contains no source evidence or model output.';
