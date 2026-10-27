# Guardian policy artifacts

The WA03.001 policy JSON previously stored under `docs/guardian-policy/wa03.001/` was a stale, structurally different snapshot and has been removed to avoid accidental import as an alternate policy.

## Canonical build source

- Generator: `scripts/build-wa03-guardian-policy.mjs`
- Generated policy and schemas: `guardian-policies/WA03.001/`
- Packaged import artifact: `guardian-policies/RupayKg-WA03.001-v1.policy`
- Packaging script: `scripts/package-wa03.ps1`
- Reproducibility test: `npm run test:guardian-policy`

## Reproducible generation

The generator uses deterministic, name-derived UUIDs for policy blocks. It requires an explicit `SOURCE_DATE_EPOCH` (Unix seconds) so generated timestamps are controlled by the build inputs rather than the current clock.

For a reproducible build, set the timestamp deliberately and record it in the build evidence. For example, in Bash:

```sh
SOURCE_DATE_EPOCH=1743033600 node scripts/build-wa03-guardian-policy.mjs
npm run test:guardian-policy
```

Run the generator from the repository root. Rebuild the packaged artifact only after reviewing the generated source changes; compare hashes and validate the package before any import. Do not manually maintain parallel policy JSON files.

**Artifact state warning:** the generator and reproducibility test have been updated, but this change does not itself regenerate or certify the checked-in policy bundle/package. Treat generated and packaged artifacts as pending reconciliation until their exact hashes and contents are reviewed.

**Important:** A generated or packaged file is not proof of successful Guardian import, publication, or production acceptance. Use the real Guardian environment and the live-acceptance workflow to establish those states. The controlling regulatory methodology remains BEE BM WA03.001 v1.0.
