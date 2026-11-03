# RupayKg Engineering Checkpoint — 2026-10-24

## AIM
Build RupayKg as a secure, robust, Pan-India circular-economy operating platform, not merely a pilot/demo. Evidence, audit records, EPR workflows, and MRV/environmental claims must be verifiable and grounded in applicable law and methodology.

## Standing Rules
- Apply Shakti Standards to every work session.
- Audit before changing; make coherent changes and test the exact resulting commit.
- Report only actual, evidenced work.
- Protect production data; no destructive DB changes without verified backup and restore.
- Deployment is last.
- Do not merge or deploy while critical release gates remain open.
- Golden rule: **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**

## Repository State
- Repository: `vishaltradewinds/rupaykg`
- Working branch: `shakti/production-bootstrap-tls-hardening`
- PR: #43 — open, draft, unmerged.
- Last known branch head before this checkpoint note: `0f436faa04e61f2c55e9b95d98d78ff7d9777f69`
- Prior commit `40578451b92e3ebade9c86199be921344ca53c4e` passed CI run #1977.
- CI run #1980 for `0f436faa04e61f2c55e9b95d98d78ff7d9777f69` was in progress at last check. Do not claim success until the run completes.

## Work Recently Completed
Expanded read-only diagnostics at `docs/sql/audit_privilege_diagnostics.sql` to inspect:
- Effective table privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE) for login roles.
- Canonical append function ownership, security mode, configuration, and execution access.
- Recursive role memberships and role attributes.
- PostgreSQL role-membership SET/INHERIT options.
- Relation/function ACLs, including PUBLIC/default ACLs.
- Audit mutation-protection trigger definitions and enabled state.

Latest diagnostic-script commit before this checkpoint note:
`0f436faa04e61f2c55e9b95d98d78ff7d9777f69`.

The script is diagnostic only. It has not been executed successfully against the production database.

## Production Infrastructure
Render workspace: `My Workspace`, ID `tea-dakh7k142hec73aj2kr0`.
- PostgreSQL `rupaykg-db`, ID `dpg-dakhdv95efls73e1974g-a`: **suspended due to billing**; last returned status suspended, updated 2026-10-15.
- Web service `rupaykg`, ID `srv-daki4d7qj5pc73b8qksg`: not marked suspended at last check.
- Database IP allowlist includes `0.0.0.0/0`; review after client/recovery topology is mapped.
- A read-only DB connection attempt failed because SSL/TLS was required; actual production privilege topology remains unverified.
- Backup existence and successful restore are unverified.

## Open Critical Gates
1. Audit-chain bypass risk: direct SQL INSERT may bypass the canonical append function depending on real grants/ownership. This remains an open security gate.
2. Resolve authorized database access (including billing suspension and correctly secured TLS connection).
3. Execute the read-only diagnostic and inspect actual grants/ownership/role memberships.
4. Implement a least-privilege append boundary appropriate to the actual role topology; do not guess role names or use spoofable custom GUCs as an authorization boundary.
5. Test canonical appends and direct-write bypass attempts under production-equivalent roles.
6. Verify backup restoration.
7. Continue tenant isolation, EPR reconciliation, external verification, applicable MRV methodology, and operational readiness gates.

## Release Decision
**NOT PRODUCTION-READY / NOT SHAKTI-CERTIFIED.**
PR #43 remains open/draft/unmerged. No production merge, deployment, or data mutation was performed in this checkpoint. Deployment remains on hold until critical security, recovery, compliance, and real-world acceptance gates are evidenced as passed.
