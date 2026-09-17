-- Dedicated non-LGD geography used only by the opt-in live acceptance fixture.
-- This is explicitly source-versioned acceptance metadata, not invented government geography.

insert into geography_sources (source_name, source_uri, source_version, checksum, status)
values (
  'RupayKG Acceptance Fixture Geography',
  'urn:rupaykg:acceptance:geography',
  'v1',
  encode(digest('rupaykg-acceptance-geography-v1', 'sha256'), 'hex'),
  'VERIFIED'
)
on conflict (source_name, source_version) do nothing;

insert into geography (kind, code, name, source, source_version, metadata)
select
  'CLUSTER',
  'RUPAYKG-ACCEPTANCE-V1',
  'RupayKG Live Acceptance Test Geography',
  'RupayKG Acceptance Fixture Geography',
  'v1',
  jsonb_build_object('acceptanceFixture', true, 'nonLgd', true)
where not exists (
  select 1 from geography where kind = 'CLUSTER' and code = 'RUPAYKG-ACCEPTANCE-V1'
);
