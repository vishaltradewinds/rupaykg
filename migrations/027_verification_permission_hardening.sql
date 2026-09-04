-- Verification authorization must use the same explicit permission model as the API.
-- Role names are not authoritative privileges and must not grant approval rights.

create or replace function has_verification_permission(p_identity_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from organization_memberships m
    join roles r on r.id = m.role_id
    where m.identity_id = p_identity_id
      and m.status = 'VERIFIED'
      and (
        r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
        or r.permissions @> '["verification:approve"]'::jsonb
        or r.permissions @> '["verification.approve"]'::jsonb
      )
  );
$$;
