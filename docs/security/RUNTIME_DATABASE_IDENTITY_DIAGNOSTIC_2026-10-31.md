# Runtime database identity diagnostic — 2026-10-31

## Purpose

Identify the database role actually used by a RupayKg API connection without reading or printing any secret. This is a read-only diagnostic, not a runtime endpoint and not a production change.

## Artifact

Run `scripts/diagnostics/runtime-db-role-readonly.sql` from a trusted operator workstation against a disposable production-shaped Neon branch first. It reports only:

- database, effective role (`current_user`) and login role (`session_user`);
- active schema and search path;
- role flags including superuser, BYPASSRLS, CREATEROLE and CREATEDB;
- inherited role memberships;
- selected privileges on `public.verifications` and the `public` schema.

The script starts a READ ONLY transaction and ends with ROLLBACK. It contains no DDL/DML and does not query password hashes, connection strings, application environment variables, tokens or secret stores.

## Safe execution sequence

1. Create/use an isolated rehearsal branch with compute enabled only for the test window. Do not use the production or staging endpoint for this first run.
2. Supply the rehearsal connection string directly to the local `psql` process through the operator's secret manager or a protected interactive prompt. Never paste it into chat, shell history, a ticket, or a log.
3. Run the SQL file and retain only the query result (role names and privilege flags). Redact host/database identifiers if the evidence is shared outside the engineering team.
4. Compare the result with the expected dedicated API runtime role. A tenant runtime role must not be superuser, BYPASSRLS, CREATEROLE, CREATEDB, owner of protected tables, or able to TRUNCATE/ALTER protected audit or verification structures.
5. Repeat against a live API connection only in an approved maintenance/change window, using an authenticated operator-only diagnostic mechanism or a controlled connection initiated with the same Render runtime credential. Do not add a public health endpoint and do not print the credential.
6. Record the observed role and evidence timestamp. If the runtime role is `rupaykg` or `neon_service`, keep the P1 blocker open and plan a separately rehearsed role/credential cutover.

## Important limitations

- A query run from a personal/admin connection identifies that operator's role, not Render's role. It is not evidence of the application's runtime identity.
- A database connection opened from Render's shell is only representative if it uses the exact application connection configuration and secret reference. Do not display the secret value.
- `current_user` can differ from `session_user` after `SET ROLE`; both values are required.
- A role may have effective privileges through ownership, grants, inherited memberships, SECURITY DEFINER functions, or provider-managed roles. This diagnostic is an initial identity/privilege snapshot, not a complete privilege audit.
- Neon provider roles may have capabilities beyond ordinary PostgreSQL grants. Independent review is still required.

## Acceptance criteria

- Rehearsal output identifies the intended login/effective role and shows no superuser/BYPASSRLS/CREATEROLE/CREATEDB capability.
- No unapproved inherited membership in provider-admin or migration-owner roles.
- No table ownership, TRUNCATE, trigger-management or schema CREATE privilege for the API runtime role.
- Separate migration owner and worker roles are documented and tested.
- Exact Render runtime identity is evidenced without disclosing credentials.
- Negative cross-tenant tests and connection-pool context-reset tests pass before any RLS enablement.

## Release status

**P1 OPEN — NOT PRODUCTION APPROVED.** This diagnostic does not change roles, grants, ownership, passwords, environment variables, deployments, RLS, or data. No live execution is authorized by this document.
