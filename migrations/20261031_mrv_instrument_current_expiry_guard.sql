-- Forward migration: previously applied migrations must not be edited in place.
-- Registry value-bearing paths share this function to revalidate instrument lifecycle,
-- MeitY validity, required calibration validity, firmware support and reviewed evidence.

create or replace function mrv_instrument_evidence_is_current(p_instrument_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
      from mrv_instruments i
     where i.id = p_instrument_id
       -- Enforce lifecycle and expiry at the shared database gate, not only in API code.
       and i.approval_status = 'VERIFIED'
       and (
         (i.meity_validity_basis = 'NO_EXPIRY_CONFIRMED' and i.meity_valid_until is null)
         or
         (i.meity_validity_basis = 'VALID_UNTIL' and i.meity_valid_until > now())
       )
       and (
         not i.calibration_required
         or (
           i.calibration_status = 'VERIFIED'
           and i.calibration_valid_until is not null
           and i.calibration_valid_until > now()
         )
       )
       and (
         i.firmware_version is null
         or (
           i.firmware_support_until is not null
           and i.firmware_support_until > now()
         )
       )
       and exists (
         select 1
           from evidence_artifact_versions v
           join evidence e on e.id = v.evidence_id
           join evidence_artifact_series s on s.id = v.series_id
          where v.id = i.meity_evidence_artifact_version_id
            and v.sha256 = lower(i.meity_evidence_sha256)
            and octet_length(v.content) = v.size_bytes
            and encode(digest(v.content, 'sha256'), 'hex') = v.sha256
            and e.content_hash = v.sha256 and e.status = 'VERIFIED'
            and s.organization_id = i.organization_id
            and exists (
              select 1 from evidence_artifact_reviews r
               where r.evidence_id=e.id and r.artifact_version_id=v.id
                 and r.reviewer_identity_id <> v.uploaded_by_identity_id
                 and r.id = (select latest.id from evidence_artifact_reviews latest
                              where latest.evidence_id=e.id and latest.artifact_version_id=v.id
                              order by latest.review_sequence desc limit 1)
                 and r.decision='APPROVED'
            )
       )
       and (
         not i.calibration_required
         or exists (
           select 1
             from evidence_artifact_versions v
             join evidence e on e.id = v.evidence_id
             join evidence_artifact_series s on s.id = v.series_id
            where v.id = i.calibration_evidence_artifact_version_id
              and v.sha256 = lower(i.calibration_evidence_sha256)
              and octet_length(v.content) = v.size_bytes
              and encode(digest(v.content, 'sha256'), 'hex') = v.sha256
              and e.content_hash = v.sha256 and e.status = 'VERIFIED'
              and s.organization_id = i.organization_id
              and exists (
                select 1 from evidence_artifact_reviews r
                 where r.evidence_id=e.id and r.artifact_version_id=v.id
                   and r.reviewer_identity_id <> v.uploaded_by_identity_id
                   and r.id = (select latest.id from evidence_artifact_reviews latest
                                where latest.evidence_id=e.id and latest.artifact_version_id=v.id
                                order by latest.review_sequence desc limit 1)
                   and r.decision='APPROVED'
              )
         )
       )
       and (
         i.firmware_version is null
         or exists (
           select 1
             from evidence_artifact_versions v
             join evidence e on e.id = v.evidence_id
             join evidence_artifact_series s on s.id = v.series_id
            where v.id = i.security_evidence_artifact_version_id
              and v.sha256 = lower(i.security_evidence_sha256)
              and octet_length(v.content) = v.size_bytes
              and encode(digest(v.content, 'sha256'), 'hex') = v.sha256
              and e.content_hash = v.sha256 and e.status = 'VERIFIED'
              and s.organization_id = i.organization_id
              and exists (
                select 1 from evidence_artifact_reviews r
                 where r.evidence_id=e.id and r.artifact_version_id=v.id
                   and r.reviewer_identity_id <> v.uploaded_by_identity_id
                   and r.id = (select latest.id from evidence_artifact_reviews latest
                                where latest.evidence_id=e.id and latest.artifact_version_id=v.id
                                order by latest.review_sequence desc limit 1)
                   and r.decision='APPROVED'
              )
         )
       )
       and not exists (
         select 1 from mrv_instrument_parameter_specs ps
          where ps.instrument_id = i.id
            and not exists (
              select 1
                from evidence_artifact_versions v
                join evidence e on e.id = v.evidence_id
                join evidence_artifact_series s on s.id = v.series_id
               where v.id = ps.source_evidence_artifact_version_id
                 and s.organization_id = i.organization_id
                 and octet_length(v.content) = v.size_bytes
                 and encode(digest(v.content, 'sha256'), 'hex') = v.sha256
                 and e.content_hash = v.sha256 and e.status = 'VERIFIED'
                 and exists (
                   select 1 from evidence_artifact_reviews r
                    where r.evidence_id=e.id and r.artifact_version_id=v.id
                      and r.reviewer_identity_id <> v.uploaded_by_identity_id
                      and r.id = (select latest.id from evidence_artifact_reviews latest
                                   where latest.evidence_id=e.id and latest.artifact_version_id=v.id
                                   order by latest.review_sequence desc limit 1)
                      and r.decision='APPROVED'
                 )
            )
       )
  );
$$;
