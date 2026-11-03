# Archived verification-only CI marker files

**Archived on:** 2026-10-30  
**Reason:** These files were status markers, not test output or durable evidence of a particular CI run. They created ambiguity about which “latest” record was authoritative. No repository references to these filenames were found during cleanup.

| Removed path | Original Git blob SHA | Disposition |
|---|---|---|
| `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_FINAL.md` | `baf420157555756b641373d2399839414c2aa130` | Same blob/content as `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_3.md`; duplicate marker. |
| `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_3.md` | `baf420157555756b641373d2399839414c2aa130` | Duplicate marker; content preserved by this archive record and Git history. |
| `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_PR.md` | `f53ee387dca88f16286deba4a382744c6a5bc544` | Generic verification marker, no run ID, commit SHA or logs. |
| `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_PR2.md` | `d0d87a79cfc28132f494921e7724897fdf20bde4` | Generic verification marker, no run ID, commit SHA or logs. |

These deletions are proposed only in the repository-cleanup branch. Git history retains the original files; the cleanup does not erase CI logs or replace evidence. For CI claims, cite the actual workflow run and exact commit SHA.
