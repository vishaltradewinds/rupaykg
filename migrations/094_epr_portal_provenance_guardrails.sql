-- Reconcile the EPR catalogue with CPCB's Common EPR Portal while
-- preserving historical portal references for audit. This does not determine
-- scheme applicability or issue any statutory certificate.
--
-- CPCB's official Common EPR Portal is https://epr.cpcb.gov.in/.
-- The repository's regulatory baseline records the legacy plastic portal
-- migration as effective 2026-06-28. Do not silently apply this migration's
-- plastic-portal change to other streams without stream-specific confirmation.

update epr_schemes
set metadata =
  (metadata - 'legacy_portal_url') ||
  jsonb_build_object(
    'legacy_portal_url', coalesce(metadata->>'portal_url', ''),
    'portal_url', 'https://epr.cpcb.gov.in/',
    'portal_migration_note', 'CPCB Common EPR Portal; confirm stream-specific workflow and current instructions before use.',
    'portal_reference_verified_on', '2026-10-27',
    'external_authority_confirmation_required', true,
    'applicability_requires_activity_and_role_review', true,
    'platform_issues_statutory_certificates', false
  )
where code = 'PLASTIC_PACKAGING';

-- A catalogue status is not an entity-level legal determination. Keep the
-- historical status column intact for compatibility, but make the boundary
-- explicit in metadata for every seeded scheme.
update epr_schemes
set metadata = metadata || jsonb_build_object(
  'external_authority_confirmation_required', true,
  'applicability_requires_activity_and_role_review', true,
  'platform_issues_statutory_certificates', false,
  'internal_credit_record_is_not_external_certificate', true
)
where code in ('PLASTIC_PACKAGING','E_WASTE','BATTERY','WASTE_TYRE','C_AND_D');
