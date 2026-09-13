-- Governance metadata for stakeholder onboarding decisions.
-- Applicant note remains applicant-authored; review_note is the authoritative
-- platform decision rationale and is never used to grant operational access.
alter table stakeholder_applications
  add column if not exists review_note text;

create index if not exists stakeholder_applications_reviewed_idx
  on stakeholder_applications(reviewed_at desc)
  where reviewed_at is not null;
