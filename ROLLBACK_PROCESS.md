# Rollback Process

## Rule

Do not roll the repository history backwards to handle a failed release.

A rollback restores an earlier deployed version while preserving all later
source history.

## Safe Rollback Options

Use one of these options:

- Redeploy the previous production artifact.
- Deploy from the previous immutable release tag.
- Create a forward revert commit that undoes the faulty change.

Do not use:

- `git reset --hard` against an older version.
- destructive checkout over `main`.
- force push to `main`.
- deleting or moving release tags.

## Required Preflight

Before any rollback or risky operation:

1. Record the current commit SHA.
2. Verify the current branch.
3. Verify the remote URL.
4. Inspect `git status --short --branch`.
5. Create a recovery branch or tag if appropriate.
6. Confirm the exact release tag or artifact to restore.

If there is uncertainty, stop and ask the Product Owner.

## Example Safe Rollback

```bash
git fetch origin --prune --tags
git switch -c rollback/redeploy-v1.0.1 v1.0.1
npm ci
npm run build
```

Deploy the artifact built from the tag. Do not move `main` backwards.
