-- Versioned regulatory source catalog. This is reference/configuration data, not a legal advice engine.

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
  notes text,
  created_at timestamptz not null default now(),
  unique(authority, title, reference)
);

create index regulatory_status_idx on regulatory_sources(status, effective_from);
create index regulatory_module_idx on regulatory_sources(affected_module);

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
values
('Ministry of Environment, Forest and Climate Change','Solid Waste Management Rules, 2026','RULE','S.O. 388(E)','2026-01-27','2026-04-01','India','https://moef.gov.in/rules-regulations-3','2026-09-02','IN_FORCE','waste','Applies to urban and rural local bodies and entities within their jurisdictions; separate waste streams remain governed by their own regimes.'),
('Bureau of Energy Efficiency / Ministry of Power','Carbon Credit Trading Scheme (CCTS) framework','REGULATION','CCTS','2023-06-28',null,'India','https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=189','2026-09-02','IN_FORCE','carbon','Use current BEE procedures and applicable methodology/version controls for compliance and offset workflows.'),
('Bureau of Energy Efficiency','Accredited Carbon Verification Agency register','GUIDELINE',null,'2026-07-14',null,'India','https://beeindia.gov.in/view_content.php?lang=1&lid=568','2026-09-02','IN_FORCE','mrv','Verifier eligibility must be checked against the current official register and applicable mechanism/sector accreditation.'),
('Ministry of Environment, Forest and Climate Change','India-Japan Joint Crediting Mechanism implementation rules under Article 6.2','ORDER',null,'2026-07-22',null,'India / Japan','https://moef.gov.in/orders/update?archive=1','2026-09-02','NOTIFIED','carbon','Article 6 cooperation must remain distinct from domestic CCTS issuance and ordinary carbon calculations.');
