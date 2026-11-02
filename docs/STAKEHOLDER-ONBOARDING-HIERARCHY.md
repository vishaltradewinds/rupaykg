# RupayKg Stakeholder Onboarding & Hierarchy

RupayKg treats authentication, onboarding, verification and operational activation as separate states.

## Role selection
A user selects a supported stakeholder role. The role determines the organization type and the operational permissions provisioned after approval. Administrative roles are not public onboarding choices.

## Approval chain
Where a geography is supplied, the system creates an approval chain from the geography hierarchy:

- Urban local geography (ULB/Ward/Locality): **LOCAL → DISTRICT → STATE → PLATFORM**
- Rural local geography (Gram Panchayat/Village/Cluster): **LOCAL → DISTRICT → STATE → PLATFORM**
- Sub-district/District: **DISTRICT → STATE → PLATFORM**
- State/UT: **STATE → PLATFORM**
- No applicable geography: **PLATFORM**

Submission never equals activation.

## Authority mapping
- LOCAL urban: verified `municipal_admin` with target geography scope.
- LOCAL rural: verified `regulator` with target geography scope.
- DISTRICT: verified `regulator` or `state_admin` with target geography scope.
- STATE: verified `state_admin` or `regulator` with target geography scope.
- PLATFORM: verified `platform_admin` or `super_admin`.

The approver must be different from the applicant. Geography authorization is evaluated server-side against verified organization geography scope.

## Legal verification
Organization-backed stakeholders must provide legal identity and verification evidence. Platform authority verifies this evidence before final platform approval. Individual onboarding does not require organization legal evidence.

Legal verification does not represent CPCB, SPCB, ULB, government, registry, or other external statutory acceptance.

## Activation rule
Only after every required hierarchy step is approved does the final platform step activate the organization, verified membership and pending geography scope. PostgreSQL guards prevent direct membership activation without an approved stakeholder application and prevent application approval while required hierarchy steps remain pending.

Rejection at any hierarchy step rejects the application and blocks operational membership activation.

## Trust boundary
Firebase authentication proves the identity. PostgreSQL is authoritative for organization membership, geography scope, onboarding approvals and operational access. Onboarding approval does not imply MRV verification, carbon issuance, registry consensus, government issuance or settlement.
