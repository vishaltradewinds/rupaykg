-- Do not assert a negative external registration fact when RupayKG has no
-- authoritative registration response. Existing unverified rows become UNKNOWN.
update bwg_profiles
set regulatory_registration_status = 'UNKNOWN'
where regulatory_registration_status = 'NOT_REGISTERED';

alter table bwg_profiles
  alter column regulatory_registration_status set default 'UNKNOWN';
