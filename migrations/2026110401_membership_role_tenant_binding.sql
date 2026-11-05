-- Enforce that every organization membership references a role owned by
-- that same organization. The single-column role_id FK is not sufficient.

create unique index if not exists roles_id_organization_id_uq
  on public.roles(id, organization_id);

create index if not exists organization_memberships_role_organization_idx
  on public.organization_memberships(role_id, organization_id);

do $migration$
declare
  existing_definition text;
begin
  select pg_get_constraintdef(c.oid)
    into existing_definition
    from pg_constraint c
   where c.conrelid = 'public.organization_memberships'::regclass
     and c.conname = 'organization_memberships_role_organization_fk';

  if existing_definition is null then
    alter table public.organization_memberships
      add constraint organization_memberships_role_organization_fk
      foreign key (role_id, organization_id)
      references public.roles(id, organization_id)
      not valid;
  elsif position('FOREIGN KEY (role_id, organization_id) REFERENCES roles(id, organization_id)' in existing_definition) <> 1 then
    raise exception 'organization_memberships_role_organization_fk exists with an unexpected definition: %', existing_definition;
  end if;
end;
$migration$;

alter table public.organization_memberships
  validate constraint organization_memberships_role_organization_fk;

comment on constraint organization_memberships_role_organization_fk on public.organization_memberships is
  'A membership can only reference a role owned by the same organization; prevents cross-tenant role binding.';
