-- Agricultural residue operations evidence layer. This migration does not authorize credit issuance.
create table if not exists agri_residue_fields (
 id uuid primary key,
 organization_id uuid not null references organizations(id),
 parcel_reference text not null,
 farmer_reference text,
 village_code text,
 district_code text,
 state_code text not null default 'IN-MP',
 crop_code text not null,
 crop_season text not null,
 area_hectares numeric(18,6) not null check (area_hectares > 0),
 boundary_geojson jsonb not null,
 land_use_evidence_reference text,
 land_use_evidence_hash char(64) check (land_use_evidence_hash is null or land_use_evidence_hash ~ '^[a-f0-9]{64}$'),
 baseline_status text not null default 'PENDING_REVIEW'
   check (baseline_status in ('PENDING_REVIEW','EVIDENCE_RECORDED','REVIEWED','REJECTED')),
 baseline_evidence_reference text,
 baseline_evidence_hash char(64) check (baseline_evidence_hash is null or baseline_evidence_hash ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references identities(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (organization_id,parcel_reference),
 check (jsonb_typeof(boundary_geojson)='object')
);
create index if not exists agri_residue_fields_org_idx on agri_residue_fields(organization_id,created_at desc);
create table if not exists agri_residue_fire_observations (
 id uuid primary key,
 field_id uuid not null references agri_residue_fields(id),
 observation_source text not null,
 observed_at timestamptz not null,
 detected_fire boolean not null,
 confidence numeric(6,5) check (confidence is null or (confidence >= 0 and confidence <= 1)),
 spatial_intersection jsonb,
 evidence_reference text not null,
 evidence_hash char(64) not null check (evidence_hash ~ '^[a-f0-9]{64}$'),
 review_status text not null default 'PENDING_REVIEW'
   check (review_status in ('PENDING_REVIEW','CONFIRMED','DISMISSED','INCONCLUSIVE')),
 review_note text,
 reviewed_by uuid references identities(id),
 reviewed_at timestamptz,
 created_by uuid not null references identities(id),
 created_at timestamptz not null default now(),
 check ((review_status='PENDING_REVIEW' and reviewed_by is null and reviewed_at is null)
     or (review_status<>'PENDING_REVIEW' and reviewed_by is not null and reviewed_at is not null))
);
create index if not exists agri_residue_fire_field_time_idx on agri_residue_fire_observations(field_id,observed_at desc);
create table if not exists agri_residue_lots (
 id uuid primary key,
 organization_id uuid not null references organizations(id),
 lot_code text not null,
 source_field_id uuid references agri_residue_fields(id),
 residue_type text not null,
 crop_season text not null,
 net_mass numeric(24,8) not null check (net_mass > 0),
 mass_unit text not null check (mass_unit in ('kg','t')),
 moisture_percent numeric(7,4) check (moisture_percent is null or (moisture_percent >= 0 and moisture_percent <= 100)),
 mass_basis text not null check (mass_basis in ('AS_RECEIVED','DRY_MATTER','UNKNOWN')),
 weighing_reference text not null,
 weighing_evidence_hash char(64) not null check (weighing_evidence_hash ~ '^[a-f0-9]{64}$'),
 measured_at timestamptz not null,
 custody_status text not null default 'AT_SOURCE'
   check (custody_status in ('AT_SOURCE','COLLECTED','IN_TRANSIT','AT_DEPOT','DELIVERED','PROCESSED','REJECTED','DISPUTED')),
 created_by uuid not null references identities(id),
 created_at timestamptz not null default now(),
 unique (organization_id,lot_code)
);
create index if not exists agri_residue_lots_org_idx on agri_residue_lots(organization_id,measured_at desc);
create table if not exists agri_residue_custody_events (
 id uuid primary key,
 lot_id uuid not null references agri_residue_lots(id),
 event_type text not null check (event_type in ('COLLECTED','WEIGHED','TRANSFERRED','TRANSPORT_STARTED','TRANSPORT_ARRIVED','STORED','DELIVERED','PROCESSED','REJECTED','CORRECTED')),
 event_at timestamptz not null,
 actor_organization_id uuid references organizations(id),
 counterparty_organization_id uuid references organizations(id),
 location_geojson jsonb,
 vehicle_reference text,
 ticket_reference text,
 evidence_reference text not null,
 evidence_hash char(64) not null check (evidence_hash ~ '^[a-f0-9]{64}$'),
 details jsonb not null default '{}'::jsonb,
 created_by uuid not null references identities(id),
 created_at timestamptz not null default now()
);
create index if not exists agri_residue_custody_lot_time_idx on agri_residue_custody_events(lot_id,event_at);
create table if not exists agri_residue_processing_receipts (
 id uuid primary key,
 lot_id uuid not null references agri_residue_lots(id),
 processor_organization_id uuid not null references organizations(id),
 process_type text not null check (process_type in ('CBG','BIOMASS_ELECTRICITY','BIOMASS_HEAT','PELLETIZATION','COMPOSTING','IN_SITU_TREATMENT','OTHER')),
 received_mass numeric(24,8) not null check (received_mass > 0),
 mass_unit text not null check (mass_unit in ('kg','t')),
 received_at timestamptz not null,
 weighbridge_reference text not null,
 evidence_hash char(64) not null check (evidence_hash ~ '^[a-f0-9]{64}$'),
 process_data jsonb not null default '{}'::jsonb,
 created_by uuid not null references identities(id),
 created_at timestamptz not null default now()
);
create table if not exists agri_residue_methodology_reviews (
 id uuid primary key,
 offset_project_id uuid not null references industrial_ccts_offset_projects(id),
 methodology_code text not null check (methodology_code in ('BM AG04.002','BM WA03.003','BM EN01.003')),
 methodology_version text,
 applicability_status text not null default 'PENDING_REVIEW'
   check (applicability_status in ('PENDING_REVIEW','IN_SCOPE','OUT_OF_SCOPE','MORE_EVIDENCE_REQUIRED','SUPERSEDED')),
 official_methodology_reference text not null,
 official_methodology_hash char(64) check (official_methodology_hash is null or official_methodology_hash ~ '^[a-f0-9]{64}$'),
 reviewer_identity_id uuid references identities(id),
 reviewed_at timestamptz,
 review_findings jsonb not null default '{}'::jsonb,
 created_by uuid not null references identities(id),
 created_at timestamptz not null default now(),
 check ((applicability_status='PENDING_REVIEW' and reviewer_identity_id is null and reviewed_at is null)
     or (applicability_status<>'PENDING_REVIEW' and reviewer_identity_id is not null and reviewed_at is not null))
);
create index if not exists agri_residue_methodology_project_idx on agri_residue_methodology_reviews(offset_project_id,created_at desc);
insert into industrial_ccts_regulatory_sources(source_id,publisher,title,source_url,source_date,review_status,details) values
('BEE-AGRI-RESIDUE-METHODOLOGIES','Bureau of Energy Efficiency','Approved Methodologies and Tools under CCTS Offset Mechanism','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','NEEDS_CURRENT_VERIFICATION','{"methodologies":["BM AG04.002","BM WA03.003","BM EN01.003"],"note":"Register listing does not establish project-specific applicability. Retrieve the full current approved methodology and validate scope before credit quantification."}')
on conflict(source_id) do nothing;
