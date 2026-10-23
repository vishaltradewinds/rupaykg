-- Register the current Solid Waste Management Rules, 2026 as an authoritative
-- regulatory source. Applicability and detailed obligations must still be mapped
-- by stakeholder and rule clause; this source row does not determine tenant status.
insert into regulatory_sources
  (authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
values
  (
    'Ministry of Environment, Forest and Climate Change',
    'Solid Waste Management Rules, 2026',
    'RULE',
    'S.O. 388(E)',
    '2026-01-27',
    '2026-04-01',
    'India',
    'https://moef.gov.in/uploads/pdf-uploads/pdf_69a16e3b04c107.91022257.pdf',
    '2026-10-23',
    'IN_FORCE',
    'cpcb_swm',
    'Official Gazette notification S.O. 388(E), dated 27 January 2026; the Rules came into force on 1 April 2026. Applicability, reporting duties, portal status, and local-body/BWG responsibilities must be evaluated by applicable rule clause and verified evidence. This catalog entry does not itself determine any organization''s statutory status.'
  )
on conflict (authority,title,reference) do update set
  published_on = excluded.published_on,
  effective_from = excluded.effective_from,
  jurisdiction = excluded.jurisdiction,
  source_url = excluded.source_url,
  verified_on = excluded.verified_on,
  status = excluded.status,
  affected_module = excluded.affected_module,
  notes = excluded.notes;
