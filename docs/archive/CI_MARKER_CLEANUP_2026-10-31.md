# CI marker cleanup archive — 2026-10-31

These four transient “latest CI” status-marker files are being retired from the active working tree in this review branch. Their Git blob IDs are preserved below; original contents remain recoverable from Git history.

| Removed path | Original Git blob SHA | Note |
|---|---|---|
| `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_3.md` | `baf420157555756b641373d2399839414c2aa130` | Exact duplicate blob of FINAL marker |
| `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_FINAL.md` | `baf420157555756b641373d2399839414c2aa130` | Exact duplicate blob of _3 marker |
| `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_PR.md` | `f53ee387dca88f16286deba4a382744c6a5bc544` | One-off PR verification marker |
| `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_PR2.md` | `d0d87a79cfc28132f494921e7724897fdf20bde4` | One-off PR verification marker |

## Replacement evidence rule

Record CI evidence by exact tested commit SHA, GitHub Actions workflow run URL/conclusion, suites and artifacts, and whether the tested SHA equals the proposed merge/deploy SHA. State what the run does not prove (live deployment, statutory approval, certification or TRL). Do not infer a CI result from a marker filename.

No migration, source code, production data, credential, Neon branch/endpoint or live service is changed by retiring these documentation markers.
