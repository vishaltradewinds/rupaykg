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

-- Organization geography scopes are authorization anchors, not global data.
alter table public.organization_geography_scopes enable row level security;
alter table public.organization_geography_scopes force row level security;
drop policy if exists shakti_organization_geography_scopes_tenant_read on public.organization_geography_scopes;
create policy shakti_organization_geography_scopes_tenant_read
  on public.organization_geography_scopes for select
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and status = 'VERIFIED'
    and app.is_verified_org_member(organization_id)
  );
grant select on public.organization_geography_scopes to rupaykg_app_runtime;

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

-- Registry events are tenant-visible only to organizations named in the event.
-- The SECURITY DEFINER owner receives a narrow read policy solely so the
-- current-owner helper can resolve the latest owner without recursive RLS.
alter table public.registry_events enable row level security;
alter table public.registry_events force row level security;

drop policy if exists shakti_registry_events_tenant on public.registry_events;
create policy shakti_registry_events_tenant
  on public.registry_events for all
  to rupaykg_app_runtime
  using (
    app.is_verified_org_member(app.current_organization_id())
    and (
      from_owner_id = app.current_organization_id()
      or to_owner_id = app.current_organization_id()
    )
  )
  with check (
    recorded_by_identity_id = app.current_identity_id()
    and app.is_verified_org_member(app.current_organization_id())
    and (
      (event_type in ('ISSUED','ACTIVATED') and to_owner_id = app.current_organization_id())
      or (event_type in ('TRANSFERRED','RETIRED') and from_owner_id = app.current_organization_id())
    )
  );

drop policy if exists shakti_registry_events_owner_read on public.registry_events;
create policy shakti_registry_events_owner_read
  on public.registry_events for select
  to rupaykg_security_definer
  using (true);

grant select, insert on public.registry_events to rupaykg_app_runtime;
grant select on public.registry_events to rupaykg_security_definer;

create or replace function app.current_credential_owner_id(target_credential_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, app
as $function$
  select coalesce(event_row.to_owner_id, event_row.from_owner_id)
    from public.registry_events event_row
   where event_row.credential_id = target_credential_id
     and event_row.event_type in ('ISSUED','TRANSFERRED','RETIRED')
   order by event_row.created_at desc, event_row.id desc
   limit 1
$function$;

alter function app.current_credential_owner_id(uuid) owner to rupaykg_security_definer;
revoke all on function app.current_credential_owner_id(uuid) from public;
grant execute on function app.current_credential_owner_id(uuid) to rupaykg_app_runtime;

-- A credential remains visible to its issuer and to its current registry owner.
-- Historical former owners can read only events in which they participated.
drop policy if exists shakti_credentials_tenant on public.credentials;
create policy shakti_credentials_tenant
  on public.credentials for all
  to rupaykg_app_runtime
  using (
    (
      issuer_organization_id = app.current_organization_id()
      or app.current_credential_owner_id(id) = app.current_organization_id()
    )
    and app.is_verified_org_member(app.current_organization_id())
  )
  with check (
    (
      issuer_organization_id = app.current_organization_id()
      or app.current_credential_owner_id(id) = app.current_organization_id()
    )
    and app.is_verified_org_member(app.current_organization_id())
  );

-- Methodology versions are global, read-only governance reference data.
grant select on public.methodology_versions to rupaykg_app_runtime;

-- Settlement events are append-only children of a payer/payee settlement.
alter table public.settlement_events enable row level security;
alter table public.settlement_events force row level security;
drop policy if exists shakti_settlement_events_tenant on public.settlement_events;
create policy shakti_settlement_events_tenant
  on public.settlement_events for all
  to rupaykg_app_runtime
  using (
    exists (
      select 1 from public.settlements s
       where s.id = settlement_events.settlement_id
         and (
           s.payer_id = app.current_organization_id()
           or s.payee_id = app.current_organization_id()
         )
         and app.is_verified_org_member(app.current_organization_id())
    )
  )
  with check (
    actor_identity_id = app.current_identity_id()
    and exists (
      select 1 from public.settlements s
       where s.id = settlement_events.settlement_id
         and (
           s.payer_id = app.current_organization_id()
           or s.payee_id = app.current_organization_id()
         )
         and app.is_verified_org_member(app.current_organization_id())
    )
  );
grant select, insert on public.settlement_events to rupaykg_app_runtime;

-- Environmental attribute claims are subordinate to their credential and
-- inherit its issuer/current-owner access boundary.
alter table public.environmental_attribute_claims enable row level security;
alter table public.environmental_attribute_claims force row level security;
drop policy if exists shakti_environmental_attribute_claims_tenant on public.environmental_attribute_claims;
create policy shakti_environmental_attribute_claims_tenant
  on public.environmental_attribute_claims for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
    and exists (
      select 1 from public.activities a
       where a.id = environmental_attribute_claims.activity_id
         and a.organization_id = environmental_attribute_claims.organization_id
    )
    and exists (
      select 1 from public.evidence e
       where e.id = environmental_attribute_claims.evidence_id
         and e.activity_id = environmental_attribute_claims.activity_id
    )
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
    and exists (
      select 1 from public.activities a
       where a.id = environmental_attribute_claims.activity_id
         and a.organization_id = environmental_attribute_claims.organization_id
    )
    and exists (
      select 1 from public.evidence e
       where e.id = environmental_attribute_claims.evidence_id
         and e.activity_id = environmental_attribute_claims.activity_id
    )
    and exists (
      select 1 from public.verifications v
       where v.activity_id = environmental_attribute_claims.activity_id
         and v.evidence_id = environmental_attribute_claims.evidence_id
    )
  );

grant select, insert on public.environmental_attribute_claims to rupaykg_app_runtime;

comment on table public.field_sync_envelopes is
'Shakti tenant boundary: field-sync envelopes are visible only to the verified device identity and active organization.';
comment on table public.evidence_artifact_series is
'Shakti tenant boundary: Evidence Vault series are bound to one organization and its activity.';
comment on table public.mrv_provenance_events is
'Shakti tenant boundary: Guardian/Hedera provenance is bound to the same activity, evidence and verification chain.';
