-- Shakti controlled verifier read access for registry provenance.
-- Ownership-based access remains unchanged. A verifier may additionally read the
-- complete lifecycle of credentials for which that identity is the recorded verifier.

create policy shakti_registry_events_select_assigned_verifier
on public.registry_events
for select
using (
  exists (
    select 1
      from public.credentials c
      join public.verifications v on v.id = c.verification_id
     where c.id = registry_events.credential_id
       and v.verifier_identity_id = app.current_identity_id()
       and v.decision = 'APPROVED'
  )
);

-- No additional write authority is granted by this policy.
