-- Make the Indian Carbon Market mechanism a first-class, fail-closed dimension.
-- Compliance and offset pathways share MRV/provenance infrastructure but have
-- different eligibility, participation and issuance rules.

create table if not exists carbon_market_mechanisms (
  code text primary key,
  name text not null,
  participation_model text not null check (participation_model in ('MANDATORY','VOLUNTARY_PROJECT_BASED')),
  authority text not null,
  source_url text not null,
  status regulatory_status not null default 'IN_FORCE',
  description text not null
);

insert into carbon_market_mechanisms(code,name,participation_model,authority,source_url,status,description)
values
('COMPLIANCE','CCTS Compliance Mechanism','MANDATORY','Bureau of Energy Efficiency','https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116','IN_FORCE','Mandatory mechanism for notified obligated entities subject to prescribed GHG emission-intensity targets; surplus/shortfall is determined against the applicable target and issuance/surrender follows the competent-authority process.'),
('OFFSET','CCTS Offset Mechanism','VOLUNTARY_PROJECT_BASED','Bureau of Energy Efficiency','https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=640&ls_id=737','IN_FORCE','Voluntary project-based baseline-and-credit mechanism for eligible non-obligated entities; project eligibility, methodology, validation/verification and issuance follow the current detailed procedure.'),
('OTHER','Other/External Carbon Mechanism','VOLUNTARY_PROJECT_BASED','Competent authority/programme','https://beeindia.gov.in/','IN_FORCE','Reserved for an explicitly identified external mechanism; it cannot be treated as CCTS issuance unless the applicable authority/programme and rules are recorded.')
on conflict (code) do update set
  name=excluded.name,
  participation_model=excluded.participation_model,
  authority=excluded.authority,
  source_url=excluded.source_url,
  status=excluded.status,
  description=excluded.description;

alter table methodology_versions
  add column if not exists carbon_mechanism text not null default 'OFFSET' references carbon_market_mechanisms(code);

alter table carbon_projects
  add column if not exists carbon_mechanism text not null default 'OFFSET' references carbon_market_mechanisms(code),
  add column if not exists regulatory_source_id uuid references regulatory_sources(id);

alter table carbon_calculations
  add column if not exists carbon_mechanism text not null default 'OFFSET' references carbon_market_mechanisms(code),
  add column if not exists regulatory_source_id uuid references regulatory_sources(id);

create index if not exists methodology_carbon_mechanism_idx on methodology_versions(carbon_mechanism);
create index if not exists carbon_projects_mechanism_idx on carbon_projects(carbon_mechanism);
create index if not exists carbon_calculations_mechanism_idx on carbon_calculations(carbon_mechanism);

-- A methodology and calculation must carry the same mechanism. This prevents
-- an offset methodology from silently being used as a compliance calculation,
-- or vice versa.
create or replace function enforce_carbon_methodology_mechanism()
returns trigger language plpgsql as $$
declare
  method_mechanism text;
begin
  select carbon_mechanism into method_mechanism from methodology_versions where id = new.methodology_version_id;
  if method_mechanism is null then
    raise exception 'carbon methodology mechanism is required';
  end if;
  if new.carbon_mechanism <> method_mechanism then
    raise exception 'carbon calculation mechanism must match methodology mechanism';
  end if;
  return new;
end;
$$;

drop trigger if exists carbon_calculation_mechanism_guard on carbon_calculations;
create trigger carbon_calculation_mechanism_guard
before insert or update of methodology_version_id, carbon_mechanism on carbon_calculations
for each row execute function enforce_carbon_methodology_mechanism();
