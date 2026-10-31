-- A pending crosswalk's expiry is part of its review envelope and must not be extended during approval.
-- This prevents a direct database update from reviving an expired request by changing expires_at
-- in the same statement that marks the request APPROVED.
create or replace function prevent_government_crosswalk_request_expiry_mutation()
returns trigger language plpgsql as $$
begin
  if new.expires_at is distinct from old.expires_at then
    raise exception 'GOVERNMENT_CROSSWALK_EXPIRY_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists government_crosswalk_request_expiry_immutable on government_jurisdiction_crosswalk_requests;
create trigger government_crosswalk_request_expiry_immutable
before update of expires_at on government_jurisdiction_crosswalk_requests
for each row execute function prevent_government_crosswalk_request_expiry_mutation();

comment on function prevent_government_crosswalk_request_expiry_mutation() is
  'Shakti governance control: request expiry cannot be extended or rewritten during approval; expired requests must be resubmitted.';
