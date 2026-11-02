-- A statutory portal reference identifies one external filing and must not
-- be rebound to a second RupayKG return. Keep NULL/empty values reusable.
create unique index if not exists epr_returns_external_reference_uq
  on epr_returns(external_reference)
  where external_reference is not null and btrim(external_reference) <> '';
