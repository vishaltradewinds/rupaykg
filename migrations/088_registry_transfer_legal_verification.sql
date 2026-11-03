-- Require a governed organization verification record before a registry credential can be transferred.
-- organizations.status defaults to VERIFIED for compatibility and is not proof of legal verification.
-- A transfer recipient must have the separate legal-verification state and a verified evidence record.

create or replace function prevent_unverified_registry_transfer_recipient()
returns trigger
language plpgsql
as $$
declare
  recipient_status record_status;
  recipient_verification_status text;
  recipient_verified_by uuid;
  recipient_verified_at timestamptz;
begin
  if new.event_type = 'TRANSFERRED' then
    if new.to_owner_id is null then
      raise exception 'Registry transfer requires a destination organization';
    end if;

    select o.status, o.verification_status, o.verified_by_identity_id, o.verified_at
      into recipient_status, recipient_verification_status, recipient_verified_by, recipient_verified_at
      from organizations o
     where o.id = new.to_owner_id;

    if not found
       or recipient_status <> 'VERIFIED'
       or recipient_verification_status <> 'VERIFIED'
       or recipient_verified_by is null
       or recipient_verified_at is null then
      raise exception 'Registry transfer destination must have verified organization and legal-verification status';
    end if;

    if not exists (
      select 1
        from organization_verification_evidence e
       where e.organization_id = new.to_owner_id
         and e.status = 'VERIFIED'
         and e.verified_by_identity_id is not null
         and e.verified_at is not null
         and (nullif(trim(e.document_reference), '') is not null
              or nullif(trim(e.content_hash), '') is not null)
    ) then
      raise exception 'Registry transfer destination requires verified organization evidence';
    end if;

    if not exists (
      select 1 from organization_memberships m
       where m.organization_id = new.to_owner_id
         and m.status = 'VERIFIED'
    ) then
      raise exception 'Registry transfer destination must have verified organization membership';
    end if;

    if new.from_owner_id is not null and new.from_owner_id = new.to_owner_id then
      raise exception 'Registry transfer destination must differ from current owner';
    end if;
  end if;

  return new;
end;
$$;
