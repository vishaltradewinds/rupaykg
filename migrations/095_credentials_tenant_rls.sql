-- Shakti tenant boundary for registry credentials.
-- Credential authority follows the latest authoritative registry owner; issuance
-- is initially scoped to the verified issuer organization.

alter table public.credentials enable row level security;

create policy shakti_credentials_select_current_owner
on public.credentials
for select
using (
  exists (
    select 1
      from public.registry_events re
     where re.credential_id = credentials.id
       and coalesce(re.to_owner_id, re.from_owner_id) = app.current_organization_id()
       and re.id = (
         select latest.id
           from public.registry_events latest
          where latest.credential_id = credentials.id
          order by latest.created_at desc, latest.id desc
          limit 1
       )
  )
);

create policy shakti_credentials_insert_issuer
on public.credentials
for insert
with check (issuer_organization_id = app.current_organization_id());

create policy shakti_credentials_update_current_owner
on public.credentials
for update
using (
  exists (
    select 1
      from public.registry_events re
     where re.credential_id = credentials.id
       and coalesce(re.to_owner_id, re.from_owner_id) = app.current_organization_id()
       and re.id = (
         select latest.id
           from public.registry_events latest
          where latest.credential_id = credentials.id
          order by latest.created_at desc, latest.id desc
          limit 1
       )
  )
)
with check (issuer_organization_id = credentials.issuer_organization_id);

revoke delete on public.credentials from rupaykg_app_runtime;
grant select, insert, update on public.credentials to rupaykg_app_runtime;
