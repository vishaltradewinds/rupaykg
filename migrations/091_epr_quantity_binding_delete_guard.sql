-- Prevent deletion of EPR quantity provenance.
-- Corrections must use an explicit, reviewed append-only reversal workflow;
-- deleting the row would release unique measurement/custody keys for reuse.
create or replace function prevent_epr_quantity_binding_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'EPR quantity binding deletion is prohibited; use reviewed reversal workflow';
end;
$$;

drop trigger if exists epr_quantity_binding_delete_guard on epr_return_quantity_bindings;
create trigger epr_quantity_binding_delete_guard
before delete on epr_return_quantity_bindings
for each row execute function prevent_epr_quantity_binding_delete();
