-- ESG metrics must persist the methodology version used for any verified disclosure.
alter table esg_metrics
  add column if not exists methodology_version_id uuid references methodology_versions(id);

create index if not exists esg_metrics_methodology_version_idx
  on esg_metrics(methodology_version_id);
