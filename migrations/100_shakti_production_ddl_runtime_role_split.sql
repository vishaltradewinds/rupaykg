-- Shakti production DDL/runtime ownership separation.
-- Controlled production gate: execute only after the production activation
-- preflight has passed and the change window is explicitly approved.

do $shakti$
begin
  if not exists (select 1 from pg_roles where rolname = 'rupaykg_ddl') then
    create role rupaykg_ddl nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$shakti$;

alter table organizations owner to rupaykg_ddl;
alter table roles owner to rupaykg_ddl;
alter table activities owner to rupaykg_ddl;
alter table obligations owner to rupaykg_ddl;
alter table credentials owner to rupaykg_ddl;
alter table settlements owner to rupaykg_ddl;
alter table audit_events owner to rupaykg_ddl;
alter table resource_flows owner to rupaykg_ddl;
alter table field_devices owner to rupaykg_ddl;
alter table organization_memberships owner to rupaykg_ddl;
alter table measurements owner to rupaykg_ddl;
alter table evidence owner to rupaykg_ddl;
alter table verifications owner to rupaykg_ddl;
alter table carbon_calculations owner to rupaykg_ddl;
alter table mrv_observations owner to rupaykg_ddl;
alter table evidence_verification_requirements owner to rupaykg_ddl;
alter table chain_of_custody_links owner to rupaykg_ddl;