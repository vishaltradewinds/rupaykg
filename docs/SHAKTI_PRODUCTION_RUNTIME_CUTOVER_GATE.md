# Shakti Production Runtime Cutover Gate

## Live deployment evidence — 2026-11-07

The authoritative Render production service is:

- service: `rupaykg`
- service id: `srv-daki4d7qj5pc73b8qksg`
- branch: `main`
- repository: `vishaltradewinds/rupaykg`
- runtime: Docker
- health path: `/health`

The latest live deployment is commit:

`e9add5b80db3ce3400fac7f81b9409035c5b9670`

That deployment corresponds to the pre-PR-331 production line. The current tenant-hardening branch is therefore not yet the deployed process.

## Required cutover sequence

1. Fresh CI against the exact PR-331 release candidate.
2. Merge only after CI is green.
3. Allow Render auto-deploy of the merged main commit.
4. Confirm the deployed process is the expected release commit.
5. Switch the application connection to the managed non-BYPASSRLS runtime LOGIN.
6. Prove from the live process/connection:
   - `current_user = rupaykg_runtime_login` (or the approved replacement)
   - `rolsuper = false`
   - `rolcreaterole = false`
   - `rolcreatedb = false`
   - `rolbypassrls = false`
7. Execute representative route-level cross-tenant negative tests.
8. Enable persistent core RLS.
9. Repeat live tenant-isolation verification.
10. Consider FORCE RLS only after ownership/role separation is independently proven.

## Prohibited shortcut

Do not change production `DATABASE_URL` to the non-BYPASSRLS runtime role while the deployed application is still the pre-PR-331 process. The current production process has not been proven to satisfy the same-session tenant transaction contract across all protected paths.

## Current gate

**FAIL-CLOSED / PRODUCTION HOLD**

The runtime role is provisioned and independently exercised against the authoritative database, but the deployed application has not yet been cut over to it.

No production RLS activation is authorized by this document.
