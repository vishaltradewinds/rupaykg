-- Tighten regulatory source provenance without rewriting the historical seed migration.
-- Only exact official BEE PDFs verified against the current BEE regulatory catalog are updated.

update regulatory_sources
set source_url = 'https://www.beeindia.gov.in/showfile.php?lang=1&level=3&lid=145&ls_id=496',
    verified_on = '2026-09-04',
    notes = 'Official Gazette PDF hosted by BEE; certificate issuance and trading remain subject to competent authority processes.'
where authority = 'Bureau of Energy Efficiency'
  and title = 'Carbon Credit Trading Scheme'
  and reference = 'S.O. 2825(E)';

update regulatory_sources
set source_url = 'https://www.beeindia.gov.in/showfile.php?lang=1&level=3&lid=144&ls_id=494',
    verified_on = '2026-09-04',
    notes = 'Official Gazette amendment PDF hosted by BEE; detailed legal interpretation remains subject to the notified instrument.'
where authority = 'Bureau of Energy Efficiency'
  and title = 'Carbon Credit Trading Scheme amendments'
  and reference = 'S.O. 5369(E)';

update regulatory_sources
set source_url = 'https://www.beeindia.gov.in/showfile.php?lang=1&level=3&lid=501&ls_id=490',
    verified_on = '2026-09-04',
    notes = 'Official Gazette PDF hosted by BEE; provides the greenhouse-gas emission-intensity target framework used for the CCTS compliance mechanism.'
where authority = 'Bureau of Energy Efficiency'
  and title = 'Greenhouse Gases Emission Intensity Target Rules 2025'
  and reference = 'GEI Target Rules 2025';
