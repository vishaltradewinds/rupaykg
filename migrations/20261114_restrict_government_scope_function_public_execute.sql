-- Restrict geography-scope helper execution to explicitly granted database principals.
-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- The application owner retains owner rights; dedicated worker principals must
-- receive explicit EXECUTE grants during isolated role provisioning.
revoke all on function public.organization_has_explicit_geography_scope(uuid, uuid) from public;
revoke all on function public.government_source_scope_covers_geography(uuid, uuid) from public;
