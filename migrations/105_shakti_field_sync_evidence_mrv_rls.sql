-- 105: Extend Shakti tenant isolation to field-sync, Evidence Vault and MRV provenance.
--
-- This migration is additive to the core 17-table tenant boundary in migration
-- 101. It deliberately does not enable access to global/control-plane tables
-- beyond read-only geography reference data.

do $preflight$
begin
  if not exists (
    select 1 from pg_roles
     where rolname = 'rupaykg_app_runtime'
       and not rolsuper
       and not rolbypassrls
       and not rolcanlogin
  ) then
    raise exception 'SHAKTI_105_RUNTIME_ROLE_UNSAFE_OR_MISSING';
  end if;
end
$preflight$;

-- Geography is a versioned global reference catalogue. Tenant authorization
-- remains enforced by organization_has_geography_scope and tenant-scoped
-- activity policies; the application runtime receives read-only access only.
grant select on public.geography to rupaykg_app_runtime;

-- The Evidence Vault routes already target these authoritative relational
-- records. Define their schema before applying the tenant policies below.
create table if not exists public.evidence_artifact_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  activity_id uuid not null references public.activities(id) on delete restrict,
  evidence_type text not null check (length(btrim(evidence_type)) between 1 and 100),
  created_by_identity_id uuid not null references public.identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint evidence_artifact_series_activity_org_unique unique (id, organization_id, activity_id)
);

create index if not exists evidence_artifact_series_org_activity_idx
  on public.evidence_artifact_series (organization_id, activity_id, created_at desc);

create table if not exists public.evidence_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.evidence_artifact_series(id) on delete restrict,
  evidence_id uuid not null references public.evidence(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  file_name text not null check (length(btrim(file_name)) between 1 and 180),
  media_type text not null check (media_type in ('application/pdf','image/jpeg','image/png','text/csv','text/plain','application/json')),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}
alter table public.field_sync_envelopes enable row level security;
alter table public.field_sync_envelopes force row level security;
alter table public.field_sync_cursors enable row level security;
alter table public.field_sync_cursors force row level security;
alter table public.field_sync_conflicts enable row level security;
alter table public.field_sync_conflicts force row level security;

drop policy if exists shakti_field_sync_envelopes_tenant on public.field_sync_envelopes;
create policy shakti_field_sync_envelopes_tenant
  on public.field_sync_envelopes for all
  to rupaykg_app_runtime
  using (
    identity_id = app.current_identity_id()
    and exists (
      select 1 from public.field_devices d
       where d.id = field_sync_envelopes.device_id
         and d.identity_id = field_sync_envelopes.identity_id
         and d.organization_id = app.current_organization_id()
         and d.status = 'VERIFIED'
         and app.is_verified_org_member(d.organization_id)
    )
  )
  with check (
    identity_id = app.current_identity_id()
    and exists (
      select 1 from public.field_devices d
       where d.id = field_sync_envelopes.device_id
         and d.identity_id = field_sync_envelopes.identity_id
         and d.organization_id = app.current_organization_id()
         and d.status = 'VERIFIED'
         and app.is_verified_org_member(d.organization_id)
    )
  );

drop policy if exists shakti_field_sync_cursors_tenant on public.field_sync_cursors;
create policy shakti_field_sync_cursors_tenant
  on public.field_sync_cursors for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1 from public.field_devices d
       where d.id = field_sync_cursors.device_id
         and d.identity_id = app.current_identity_id()
         and d.organization_id = app.current_organization_id()
         and d.status = 'VERIFIED'
         and app.is_verified_org_member(d.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.field_devices d
       where d.id = field_sync_cursors.device_id
         and d.identity_id = app.current_identity_id()
         and d.organization_id = app.current_organization_id()
         and d.status = 'VERIFIED'
         and app.is_verified_org_member(d.organization_id)
    )
  );

drop policy if exists shakti_field_sync_conflicts_tenant on public.field_sync_conflicts;
create policy shakti_field_sync_conflicts_tenant
  on public.field_sync_conflicts for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.field_sync_envelopes e
       where e.id = field_sync_conflicts.envelope_id
         and e.identity_id = app.current_identity_id()
    )
  )
  with check (
    exists (
      select 1
        from public.field_sync_envelopes e
       where e.id = field_sync_conflicts.envelope_id
         and e.identity_id = app.current_identity_id()
    )
  );

grant select, insert, update on
  public.field_sync_envelopes,
  public.field_sync_cursors,
  public.field_sync_conflicts
to rupaykg_app_runtime;

-- Evidence Vault artifacts inherit organization scope from their activity
-- and evidence rows. Review records are actor-bound and append-only.
alter table public.evidence_artifact_series enable row level security;
alter table public.evidence_artifact_series force row level security;
alter table public.evidence_artifact_versions enable row level security;
alter table public.evidence_artifact_versions force row level security;
alter table public.evidence_artifact_reviews enable row level security;
alter table public.evidence_artifact_reviews force row level security;

drop policy if exists shakti_evidence_artifact_series_tenant on public.evidence_artifact_series;
create policy shakti_evidence_artifact_series_tenant
  on public.evidence_artifact_series for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
    and exists (
      select 1 from public.activities a
       where a.id = evidence_artifact_series.activity_id
         and a.organization_id = evidence_artifact_series.organization_id
    )
  )
  with check (
    organization_id = app.current_organization_id()
    and created_by_identity_id = app.current_identity_id()
    and app.is_verified_org_member(organization_id)
    and exists (
      select 1 from public.activities a
       where a.id = evidence_artifact_series.activity_id
         and a.organization_id = evidence_artifact_series.organization_id
    )
  );

drop policy if exists shakti_evidence_artifact_versions_tenant on public.evidence_artifact_versions;
create policy shakti_evidence_artifact_versions_tenant
  on public.evidence_artifact_versions for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.evidence_artifact_series s
        join public.evidence e
          on e.id = evidence_artifact_versions.evidence_id
         and e.activity_id = s.activity_id
       where s.id = evidence_artifact_versions.series_id
         and s.organization_id = app.current_organization_id()
         and app.is_verified_org_member(s.organization_id)
    )
  )
  with check (
    uploaded_by_identity_id = app.current_identity_id()
    and exists (
      select 1
        from public.evidence_artifact_series s
        join public.evidence e
          on e.id = evidence_artifact_versions.evidence_id
         and e.activity_id = s.activity_id
       where s.id = evidence_artifact_versions.series_id
         and s.organization_id = app.current_organization_id()
         and app.is_verified_org_member(s.organization_id)
    )
  );

drop policy if exists shakti_evidence_artifact_reviews_tenant on public.evidence_artifact_reviews;
create policy shakti_evidence_artifact_reviews_tenant
  on public.evidence_artifact_reviews for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.evidence e
        join public.activities a on a.id = e.activity_id
       where e.id = evidence_artifact_reviews.evidence_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  )
  with check (
    reviewer_identity_id = app.current_identity_id()
    and exists (
      select 1
        from public.evidence e
        join public.activities a on a.id = e.activity_id
       where e.id = evidence_artifact_reviews.evidence_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

grant select, insert, update on public.evidence_artifact_series to rupaykg_app_runtime;
grant select, insert on public.evidence_artifact_versions to rupaykg_app_runtime;
grant select, insert on public.evidence_artifact_reviews to rupaykg_app_runtime;

-- Guardian/Hedera provenance inherits the same activity/evidence/verification
-- chain. It is mutable only for the tenant-owned execution/provenance lifecycle;
-- DELETE is never granted to the application runtime.
alter table public.mrv_provenance_events enable row level security;
alter table public.mrv_provenance_events force row level security;

drop policy if exists shakti_mrv_provenance_tenant on public.mrv_provenance_events;
create policy shakti_mrv_provenance_tenant
  on public.mrv_provenance_events for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.activities a
        join public.evidence e
          on e.id = mrv_provenance_events.evidence_id
         and e.activity_id = a.id
        join public.verifications v
          on v.id = mrv_provenance_events.verification_id
         and v.activity_id = a.id
         and v.evidence_id = mrv_provenance_events.evidence_id
       where a.id = mrv_provenance_events.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  )
  with check (
    exists (
      select 1
        from public.activities a
        join public.evidence e
          on e.id = mrv_provenance_events.evidence_id
         and e.activity_id = a.id
        join public.verifications v
          on v.id = mrv_provenance_events.verification_id
         and v.activity_id = a.id
         and v.evidence_id = mrv_provenance_events.evidence_id
       where a.id = mrv_provenance_events.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

grant select, insert, update on public.mrv_provenance_events to rupaykg_app_runtime;

comment on table public.field_sync_envelopes is
'Shakti tenant boundary: field-sync envelopes are visible only to the verified device identity and active organization.';
comment on table public.evidence_artifact_series is
'Shakti tenant boundary: Evidence Vault series are bound to one organization and its activity.';
comment on table public.mrv_provenance_events is
'Shakti tenant boundary: Guardian/Hedera provenance is bound to the same activity, evidence and verification chain.';
),
  content bytea not null,
  uploaded_by_identity_id uuid not null references public.identities(id) on delete restrict,
  source_reference text,
  measurement_period_start date,
  measurement_period_end date,
  created_at timestamptz not null default now(),
  constraint evidence_artifact_version_sequence_unique unique (series_id, version_number),
  constraint evidence_artifact_version_size_matches_content check (size_bytes = octet_length(content)),
  constraint evidence_artifact_version_period_valid check (
    measurement_period_start is null
    or measurement_period_end is null
    or measurement_period_end >= measurement_period_start
  )
);

create index if not exists evidence_artifact_versions_evidence_idx
  on public.evidence_artifact_versions (evidence_id, created_at desc);

create table if not exists public.evidence_artifact_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence(id) on delete restrict,
  artifact_version_id uuid not null references public.evidence_artifact_versions(id) on delete restrict,
  reviewer_identity_id uuid not null references public.identities(id) on delete restrict,
  decision text not null check (decision in ('APPROVED','REJECTED')),
  rationale text not null check (length(btrim(rationale)) between 5 and 2000),
  created_at timestamptz not null default now(),
  constraint evidence_artifact_review_version_unique unique (evidence_id, artifact_version_id)
);

create index if not exists evidence_artifact_reviews_evidence_idx
  on public.evidence_artifact_reviews (evidence_id, created_at desc);

-- Field-sync records inherit tenant and device identity from field_devices.
alter table public.field_sync_envelopes enable row level security;
alter table public.field_sync_envelopes force row level security;
alter table public.field_sync_cursors enable row level security;
alter table public.field_sync_cursors force row level security;
alter table public.field_sync_conflicts enable row level security;
alter table public.field_sync_conflicts force row level security;

drop policy if exists shakti_field_sync_envelopes_tenant on public.field_sync_envelopes;
create policy shakti_field_sync_envelopes_tenant
  on public.field_sync_envelopes for all
  to rupaykg_app_runtime
  using (
    identity_id = app.current_identity_id()
    and exists (
      select 1 from public.field_devices d
       where d.id = field_sync_envelopes.device_id
         and d.identity_id = field_sync_envelopes.identity_id
         and d.organization_id = app.current_organization_id()
         and d.status = 'VERIFIED'
         and app.is_verified_org_member(d.organization_id)
    )
  )
  with check (
    identity_id = app.current_identity_id()
    and exists (
      select 1 from public.field_devices d
       where d.id = field_sync_envelopes.device_id
         and d.identity_id = field_sync_envelopes.identity_id
         and d.organization_id = app.current_organization_id()
         and d.status = 'VERIFIED'
         and app.is_verified_org_member(d.organization_id)
    )
  );

drop policy if exists shakti_field_sync_cursors_tenant on public.field_sync_cursors;
create policy shakti_field_sync_cursors_tenant
  on public.field_sync_cursors for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1 from public.field_devices d
       where d.id = field_sync_cursors.device_id
         and d.identity_id = app.current_identity_id()
         and d.organization_id = app.current_organization_id()
         and d.status = 'VERIFIED'
         and app.is_verified_org_member(d.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.field_devices d
       where d.id = field_sync_cursors.device_id
         and d.identity_id = app.current_identity_id()
         and d.organization_id = app.current_organization_id()
         and d.status = 'VERIFIED'
         and app.is_verified_org_member(d.organization_id)
    )
  );

drop policy if exists shakti_field_sync_conflicts_tenant on public.field_sync_conflicts;
create policy shakti_field_sync_conflicts_tenant
  on public.field_sync_conflicts for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.field_sync_envelopes e
       where e.id = field_sync_conflicts.envelope_id
         and e.identity_id = app.current_identity_id()
    )
  )
  with check (
    exists (
      select 1
        from public.field_sync_envelopes e
       where e.id = field_sync_conflicts.envelope_id
         and e.identity_id = app.current_identity_id()
    )
  );

grant select, insert, update on
  public.field_sync_envelopes,
  public.field_sync_cursors,
  public.field_sync_conflicts
to rupaykg_app_runtime;

-- Evidence Vault artifacts inherit organization scope from their activity
-- and evidence rows. Review records are actor-bound and append-only.
alter table public.evidence_artifact_series enable row level security;
alter table public.evidence_artifact_series force row level security;
alter table public.evidence_artifact_versions enable row level security;
alter table public.evidence_artifact_versions force row level security;
alter table public.evidence_artifact_reviews enable row level security;
alter table public.evidence_artifact_reviews force row level security;

drop policy if exists shakti_evidence_artifact_series_tenant on public.evidence_artifact_series;
create policy shakti_evidence_artifact_series_tenant
  on public.evidence_artifact_series for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
    and exists (
      select 1 from public.activities a
       where a.id = evidence_artifact_series.activity_id
         and a.organization_id = evidence_artifact_series.organization_id
    )
  )
  with check (
    organization_id = app.current_organization_id()
    and created_by_identity_id = app.current_identity_id()
    and app.is_verified_org_member(organization_id)
    and exists (
      select 1 from public.activities a
       where a.id = evidence_artifact_series.activity_id
         and a.organization_id = evidence_artifact_series.organization_id
    )
  );

drop policy if exists shakti_evidence_artifact_versions_tenant on public.evidence_artifact_versions;
create policy shakti_evidence_artifact_versions_tenant
  on public.evidence_artifact_versions for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.evidence_artifact_series s
        join public.evidence e
          on e.id = evidence_artifact_versions.evidence_id
         and e.activity_id = s.activity_id
       where s.id = evidence_artifact_versions.series_id
         and s.organization_id = app.current_organization_id()
         and app.is_verified_org_member(s.organization_id)
    )
  )
  with check (
    uploaded_by_identity_id = app.current_identity_id()
    and exists (
      select 1
        from public.evidence_artifact_series s
        join public.evidence e
          on e.id = evidence_artifact_versions.evidence_id
         and e.activity_id = s.activity_id
       where s.id = evidence_artifact_versions.series_id
         and s.organization_id = app.current_organization_id()
         and app.is_verified_org_member(s.organization_id)
    )
  );

drop policy if exists shakti_evidence_artifact_reviews_tenant on public.evidence_artifact_reviews;
create policy shakti_evidence_artifact_reviews_tenant
  on public.evidence_artifact_reviews for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.evidence e
        join public.activities a on a.id = e.activity_id
       where e.id = evidence_artifact_reviews.evidence_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  )
  with check (
    reviewer_identity_id = app.current_identity_id()
    and exists (
      select 1
        from public.evidence e
        join public.activities a on a.id = e.activity_id
       where e.id = evidence_artifact_reviews.evidence_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

grant select, insert, update on public.evidence_artifact_series to rupaykg_app_runtime;
grant select, insert on public.evidence_artifact_versions to rupaykg_app_runtime;
grant select, insert on public.evidence_artifact_reviews to rupaykg_app_runtime;

-- Guardian/Hedera provenance inherits the same activity/evidence/verification
-- chain. It is mutable only for the tenant-owned execution/provenance lifecycle;
-- DELETE is never granted to the application runtime.
alter table public.mrv_provenance_events enable row level security;
alter table public.mrv_provenance_events force row level security;

drop policy if exists shakti_mrv_provenance_tenant on public.mrv_provenance_events;
create policy shakti_mrv_provenance_tenant
  on public.mrv_provenance_events for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.activities a
        join public.evidence e
          on e.id = mrv_provenance_events.evidence_id
         and e.activity_id = a.id
        join public.verifications v
          on v.id = mrv_provenance_events.verification_id
         and v.activity_id = a.id
         and v.evidence_id = mrv_provenance_events.evidence_id
       where a.id = mrv_provenance_events.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  )
  with check (
    exists (
      select 1
        from public.activities a
        join public.evidence e
          on e.id = mrv_provenance_events.evidence_id
         and e.activity_id = a.id
        join public.verifications v
          on v.id = mrv_provenance_events.verification_id
         and v.activity_id = a.id
         and v.evidence_id = mrv_provenance_events.evidence_id
       where a.id = mrv_provenance_events.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

grant select, insert, update on public.mrv_provenance_events to rupaykg_app_runtime;

comment on table public.field_sync_envelopes is
'Shakti tenant boundary: field-sync envelopes are visible only to the verified device identity and active organization.';
comment on table public.evidence_artifact_series is
'Shakti tenant boundary: Evidence Vault series are bound to one organization and its activity.';
comment on table public.mrv_provenance_events is
'Shakti tenant boundary: Guardian/Hedera provenance is bound to the same activity, evidence and verification chain.';
