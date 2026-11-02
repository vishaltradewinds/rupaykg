-- Add deterministic creation ordering to source-versioned geography records.
-- Safe for existing installations and required by the live acceptance fixture.
alter table geography
  add column if not exists created_at timestamptz not null default now();
