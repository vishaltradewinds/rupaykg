# Guardian policy artifacts

The WA03.001 policy JSON previously stored under `docs/guardian-policy/wa03.001/` was a stale, structurally different snapshot and has been removed to avoid accidental import as an alternate policy.

## Canonical build source

- Generator: `scripts/build-wa03-guardian-policy.mjs`
- Generated policy and schemas: `guardian-policies/WA03.001/`
- Packaged import artifact: `guardian-policies/RupayKg-WA03.001-v1.policy`
- Packaging script: `scripts/package-wa03.ps1`

Regenerate the bundle from the script; do not manually maintain parallel policy JSON files. The packaged artifact must be rebuilt after generator or schema changes.

**Important:** A generated or packaged file is not proof of successful Guardian import, publication, or production acceptance. Use the real Guardian environment and the live-acceptance workflow to establish those states. The controlling regulatory methodology remains BEE BM WA03.001 v1.0.
