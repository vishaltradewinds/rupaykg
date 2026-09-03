-- Versioned regulatory catalog. Regulatory status controls production applicability.

create type regulatory_status as enum (
  'DRAFT','PROPOSED','NOTIFIED','IN_FORCE','SUPERSEDED','WITHDRAWN'
);

create type regulatory_instrument as enum (
  'ACT','RULE','REGULATION','NOTIFICATION','CIRCULAR','ORDER','GUIDELINE','DRAFT','CONSULTATION'
);

create table regulatory_sources (
  id uuid primary key default gen_random_uuid(),
  authority text not null,
  title text not null,
  instrument regulatory_instrument not null,
  reference text,
  published_on date not null,
  effective_from date,
  jurisdiction text not null,
  source_url text not null,
  verified_on date not null,
  status regulatory_status not null,
  affected_module text not null,
  notes text not null default '',
  supersedes_id uuid references regulatory_sources(id),
  created_at timestamptz not null default now(),
  unique(authority, title, reference)
);

create index regulatory_status_idx on regulatory_sources(status);
create index regulatory_effective_idx on regulatory_sources(effective_from);
create index regulatory_module_idx on regulatory_sources(affected_module);

-- Current verified baseline from official Government of India sources.
insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
values
('Ministry of Environment, Forest and Climate Change','Solid Waste Management Rules, 2026','RULE','S.O. 388(E)','2026-01-27','2026-04-01','India','https://moef.gov.in/rules-regulations-3','2026-09-02','IN_FORCE','resource-flows','Applies to urban and rural local bodies and entities within their jurisdiction, subject to the rule scope and exclusions.'),
('Bureau of Energy Efficiency','Carbon Credit Trading Scheme','NOTIFICATION','S.O. 2825(E)','2023-06-28','2023-06-28','India','https://www.beeindia.gov.in/showfile.php?lang=1&level=3&lid=145&ls_id=496','2026-09-02','IN_FORCE','carbon','Official Gazette PDF hosted by BEE; certificate issuance and trading remain subject to competent authority processes.'),
('Bureau of Energy Efficiency','Carbon Credit Trading Scheme amendments','NOTIFICATION','S.O. 5369(E)','2023-12-26','2023-12-26','India','https://www.beeindia.gov.in/showfile.php?lang=1&level=3&lid=144&ls_id=494','2026-09-02','IN_FORCE','carbon','Official Gazette amendment PDF hosted by BEE; detailed legal interpretation remains subject to the notified instrument.'),
('Bureau of Energy Efficiency','Greenhouse Gases Emission Intensity Target Rules 2025','RULE','GEI Target Rules 2025','2025-07-08','2025-07-08','India','https://www.beeindia.gov.in/showfile.php?lang=1&level=3&lid=501&ls_id=490','2026-09-02','IN_FORCE','carbon','Official Gazette PDF hosted by BEE; provides the greenhouse-gas emission-intensity target framework used for the CCTS compliance mechanism.'),
('Bureau of Energy Efficiency','Detailed Procedure for Offset Mechanism and Methodologies','GUIDELINE',null,'2026-05-22','2026-05-22','India','https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=640&ls_id=737','2026-09-02','IN_FORCE','mrv','Official BEE methodology listing page; includes published offset methodologies including waste handling/disposal and agriculture; platform calculations must remain methodology-versioned.'),
('Ministry of Environment, Forest and Climate Change','Rules of Implementation for India-Japan Joint Crediting Mechanism Under Article 6.2 of the Paris Agreement','ORDER',null,'2026-07-22','2026-07-22','India','https://moef.gov.in/orders/update?archive=1','2026-09-02','IN_FORCE','carbon','Official Ministry archive reference; relevant to Article 6.2 integration. Do not treat this as authorization to issue or transfer credits without applicable external authority processes.');
