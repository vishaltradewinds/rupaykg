# Branch maintenance setup

The branch cleanup workflow is deliberately separate from the read-only inventory.

## Required one-time GitHub setup

Before merging/enabling `.github/workflows/approved-branch-cleanup.yml`:

1. In **Settings → Environments**, create an environment named `branch-maintenance`.
2. Enable **Required reviewers** and select the repository owner/maintainers who may approve cleanup.
3. Enable **Prevent self-review** where available.
4. Do not add deployment secrets; the workflow uses the short-lived `GITHUB_TOKEN`.
5. Confirm the environment protection rule is active before the first dispatch.

## Per-branch operation

A maintainer manually dispatches **Approved Branch Cleanup** and supplies:
- The exact branch name.
- The full expected SHA from `ops/github/branch-cleanup-manifest.json`.
- Confirmation text exactly `DELETE <branch-name>`.

The workflow allows only one branch per run. It checks the manifest allow-list, exact current SHA, default-branch status, branch protection, and open PR associations immediately before deletion. Any mismatch stops the run. A branch must be added to the manifest through a reviewed pull request before it can be considered.

## Important boundaries

- Candidate manifest entries are not blanket authorization to delete.
- No bulk deletion, wildcard matching, age-only deletion, PR closure, merge, branch-protection changes, Neon access, or Render deployment.
- The environment approval is required as an additional human gate. Verify its required-reviewer configuration before enabling this workflow.
- The initial manifest contains only the nine previously inspected temporary branches at SHA `2ad6b41bd4d0f8b45dca535b97bf87fb193b05b0`.
