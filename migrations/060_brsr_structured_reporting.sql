-- Structured BRSR / BRSR Core reporting metadata.
-- This layer prepares evidence-backed disclosures; it never represents external SEBI filing or acceptance.

alter table esg_reporting_periods
  add column if not exists reporting_standard text not null default 'BRSR',
  add column if not exists applicability_status text not null default 'NOT_ASSESSED',
  add column if not exists value_chain_reporting text not null default 'NOT_APPLICABLE',
  add column if not exists assurance_mode text not null default 'NOT_REQUIRED',
  add column if not exists external_submission_status text not null default 'NOT_SUBMITTED',
  add column if not exists methodology_notes text,
  add column if not exists reporting_boundary text;

alter table esg_metrics
  add column if not exists disclosure_id text,
  add column if not exists esg_attribute text,
  add column if not exists value_chain_direction text,
  add column if not exists methodology text,
  add column if not exists assumptions text,
  add column if not exists reporting_boundary text,
  add column if not exists data_quality text,
  add column if not exists assurance_status text not null default 'PENDING';

alter table esg_reporting_periods
  add constraint esg_reporting_standard_chk check (reporting_standard in ('BRSR','BRSR_CORE','BRSR_VALUE_CHAIN','INTERNAL_ESG')),
  add constraint esg_applicability_status_chk check (applicability_status in ('NOT_ASSESSED','APPLICABLE','NOT_APPLICABLE','VOLUNTARY','COMPLY_OR_EXPLAIN')),
  add constraint esg_value_chain_reporting_chk check (value_chain_reporting in ('NOT_APPLICABLE','UPSTREAM','DOWNSTREAM','BOTH','AGGREGATED')),
  add constraint esg_assurance_mode_chk check (assurance_mode in ('NOT_REQUIRED','ASSESSMENT','ASSURANCE','ASSESSMENT_OR_ASSURANCE')),
  add constraint esg_external_submission_status_chk check (external_submission_status in ('NOT_SUBMITTED','PREPARED','SUBMITTED','ACCEPTED','REJECTED'));

alter table esg_metrics
  add constraint esg_value_chain_direction_chk check (value_chain_direction is null or value_chain_direction in ('UPSTREAM','DOWNSTREAM','BOTH')),
  add constraint esg_assurance_status_chk check (assurance_status in ('PENDING','ASSESSMENT_READY','ASSESSED','ASSURANCE_READY','ASSURED','NOT_REQUIRED'));

create index if not exists esg_period_standard_idx on esg_reporting_periods(organization_id, reporting_standard, period_start, period_end);
create index if not exists esg_metric_disclosure_idx on esg_metrics(reporting_period_id, disclosure_id);
create index if not exists esg_metric_attribute_idx on esg_metrics(reporting_period_id, esg_attribute);

comment on column esg_reporting_periods.reporting_standard is 'BRSR reporting framework classification; not evidence of statutory filing.';
comment on column esg_reporting_periods.external_submission_status is 'External regulatory workflow state only when supported by authoritative external evidence.';
comment on column esg_metrics.disclosure_id is 'BRSR/BRSR Core disclosure or KPI identifier.';
comment on column esg_metrics.assurance_status is 'Internal preparation/third-party assessment or assurance state; not an assertion that an external provider completed it.';
