-- Freeze measurement history once an authoritative MRV provenance event exists.
-- The same activity-scoped advisory lock is acquired by the MRV submit route, so a
-- concurrent write cannot slip between observation collection and provenance persistence.

create or replace function guard_mrv_input_after_submission()
returns trigger language plpgsql as $$
declare
  lock_key text;
begin
  if tg_op = 'INSERT' then
    lock_key := 'rupaykg:mrv-activity:' || new.activity_id::text;
    perform pg_advisory_xact_lock(hashtext(lock_key));
    if exists (select 1 from mrv_provenance_events where activity_id = new.activity_id) then
      raise exception 'MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION: activity already has an MRV provenance event; corrections require a superseding workflow';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    -- Lock both activity keys in stable order if a measurement is being reassigned.
    if old.activity_id = new.activity_id then
      lock_key := 'rupaykg:mrv-activity:' || old.activity_id::text;
      perform pg_advisory_xact_lock(hashtext(lock_key));
    elsif old.activity_id::text < new.activity_id::text then
      perform pg_advisory_xact_lock(hashtext('rupaykg:mrv-activity:' || old.activity_id::text));
      perform pg_advisory_xact_lock(hashtext('rupaykg:mrv-activity:' || new.activity_id::text));
    else
      perform pg_advisory_xact_lock(hashtext('rupaykg:mrv-activity:' || new.activity_id::text));
      perform pg_advisory_xact_lock(hashtext('rupaykg:mrv-activity:' || old.activity_id::text));
    end if;
    if exists (select 1 from mrv_provenance_events where activity_id in (old.activity_id, new.activity_id)) then
      raise exception 'MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION: activity already has an MRV provenance event; corrections require a superseding workflow';
    end if;
    return new;
  else
    lock_key := 'rupaykg:mrv-activity:' || old.activity_id::text;
    perform pg_advisory_xact_lock(hashtext(lock_key));
    if exists (select 1 from mrv_provenance_events where activity_id = old.activity_id) then
      raise exception 'MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION: activity already has an MRV provenance event; corrections require a superseding workflow';
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists measurements_freeze_after_mrv_submission on measurements;
create trigger measurements_freeze_after_mrv_submission
before insert or update or delete on measurements
for each row execute function guard_mrv_input_after_submission();

drop trigger if exists mrv_observations_freeze_after_mrv_submission on mrv_observations;
create trigger mrv_observations_freeze_after_mrv_submission
before insert or update or delete on mrv_observations
for each row execute function guard_mrv_input_after_submission();
