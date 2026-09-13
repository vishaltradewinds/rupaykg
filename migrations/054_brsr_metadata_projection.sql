-- Project structured BRSR/BRSR Core metadata from the existing ESG API metadata payload.
-- The API remains backward-compatible: clients may continue to submit metadata JSON,
-- while authoritative relational columns are populated transactionally by PostgreSQL.
-- This is internal reporting preparation and does not assert external filing, assessment,
-- assurance, or regulatory acceptance.

create or replace function project_esg_brsr_metadata()
returns trigger
language plpgsql
as $$
begin
  new.disclosure_id := nullif(trim(coalesce(new.metadata ->> 'disclosureId', new.metadata ->> 'disclosure_id', '')), '');
  new.esg_attribute := nullif(trim(coalesce(new.metadata ->> 'esgAttribute', new.metadata ->> 'esg_attribute', '')), '');
  new.value_chain_direction := nullif(upper(trim(coalesce(new.metadata ->> 'valueChainDirection', new.metadata ->> 'value_chain_direction', ''))), '');
  new.methodology := nullif(trim(coalesce(new.metadata ->> 'methodology', '')), '');
  new.assumptions := nullif(trim(coalesce(new.metadata ->> 'assumptions', '')), '');
  new.reporting_boundary := nullif(trim(coalesce(new.metadata ->> 'reportingBoundary', new.metadata ->> 'reporting_boundary', '')), '');
  new.data_quality := nullif(trim(coalesce(new.metadata ->> 'dataQuality', new.metadata ->> 'data_quality', '')), '');
  new.assurance_status := upper(coalesce(nullif(trim(coalesce(new.metadata ->> 'assuranceStatus', new.metadata ->> 'assurance_status', '')), ''), new.assurance_status, 'PENDING'));
  return new;
end;
$$;

drop trigger if exists esg_metrics_brsr_metadata_projection on esg_metrics;
create trigger esg_metrics_brsr_metadata_projection
before insert or update of metadata on esg_metrics
for each row
execute function project_esg_brsr_metadata();

comment on function project_esg_brsr_metadata() is 'Maps ESG metadata payload fields into structured BRSR/BRSR Core columns; does not represent external regulatory acceptance.';
