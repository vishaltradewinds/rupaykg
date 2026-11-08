-- Shakti controlled verifier read access for registry provenance.
-- Ownership-based access remains unchanged. A verifier may additionally read the
-- complete lifecycle of credentials for which that identity is the recorded verifier.
--
-- SECURITY DEFINER is required here because registry_events RLS may evaluate a
-- credential that the verifier does not own. The helper is narrowly scoped to
-- one boolean lookup and exposes no credential data.

create or replace function app.is_assigned_approved_verifier(p_credential_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, app, pg_temp
as $$
  select exists (
    select 1
      from public.credentials c
      join public.verifications v on v.id = c.verification_id
      join public.identities i on i.id = v.verifier_identity_id
     where c.id = p_credential_id
       and v.verifier_identity_id = app.current_identity_id()
       and v.decision = 'APPROVED'
       and i.status = 'VERIFIED'
       and has_verification_permission(v.verifier_identity_id)
  );
$$;

revoke all on function app.is_assigned_approved_verifier(uuid) from public;
grant execute on function app.is_assigned_approved_verifier(uuid) to rupaykg_app_runtime;

drop policy if exists shakti_registry_events_select_assigned_verifier
on public.registry_events;

create policy shakti_registry_events_select_assigned_verifier
on public.registry_events
for select
using (
  app.is_assigned_approved_verifier(registry_events.credential_id)
);

-- No additional write authority is granted by this policy.
