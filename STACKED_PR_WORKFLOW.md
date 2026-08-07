# Stacked Pull Request Workflow

GitHub is the source of truth for AVS / Ornexa ERP development. No meaningful change goes directly to `main`, `master`, `develop`, `staging`, or `release/*`; every task is developed on a branch and reviewed through a pull request.

## Branch Flow

```text
feature/fix/perf/security branch
  -> stacked PRs
  -> review
  -> develop
  -> staging
  -> release/*
  -> explicit approval
  -> main/master
  -> production
```

The current repository default branch is `master`. Treat `master` as production-equivalent until the repository is migrated to `main`.

## When To Stack

Use a stack when a task is too large for one review or crosses implementation phases.

Example:

```text
develop
  -> feature/billing-foundation
  -> feature/billing-posting
  -> feature/billing-ui
  -> feature/billing-reports
```

Each PR depends only on the PR directly below it.

## Stack Rules

1. Each PR represents one logical implementation slice.
2. Keep PRs small enough to review properly.
3. Do not mix unrelated modules.
4. Each stacked branch documents its parent branch and parent PR.
5. If a lower PR changes, safely rebase or merge-update dependent branches.
6. Never merge a child PR before its required parent.
7. After a parent merges, retarget or rebase the next PR onto the correct shared branch.
8. Preserve clean commit history.
9. Never force-push protected shared branches.
10. Never deploy a stacked feature directly to production.

## Naming

Use intent-first branch names:

- `feature/<module>-<slice>`
- `fix/<module>-<problem>`
- `perf/<module>-<target>`
- `security/<module>-<control>`
- `docs/<area>-<topic>`
- `chore/<area>-<task>`

For stacks, keep a shared prefix:

```text
feature/customer-portal-foundation
feature/customer-portal-backend
feature/customer-portal-ui
feature/customer-portal-reports
```

## Creating A Stack

```sh
git fetch origin
git switch develop
git pull --ff-only

git switch -c feature/example-foundation
# commit slice 1
git push -u origin feature/example-foundation
# open PR into develop

git switch -c feature/example-backend
# commit slice 2
git push -u origin feature/example-backend
# open PR into feature/example-foundation

git switch -c feature/example-ui
# commit slice 3
git push -u origin feature/example-ui
# open PR into feature/example-backend
```

## Updating A Stack

When the parent branch changes:

```sh
git fetch origin
git switch feature/example-backend
git rebase origin/feature/example-foundation
git push --force-with-lease
```

`--force-with-lease` is allowed only on your own unprotected feature branch. It is never allowed on `main`, `master`, `develop`, `staging`, or `release/*`.

## Merge Order

Merge from the bottom upward:

1. Foundation PR into `develop`.
2. Retarget backend PR to `develop`, rebase if needed, then merge.
3. Retarget UI PR to `develop`, rebase if needed, then merge.
4. Continue until the stack is complete.

Do not merge a child PR while its parent is still open.

## Required PR Metadata

Every PR must include the template in `.github/PULL_REQUEST_TEMPLATE.md`, including:

- Goal
- Module
- Parent PR / parent branch
- Depends on
- Files changed
- Business rules affected
- Database impact
- Migration impact
- RLS/permission impact
- Universal Posting Engine impact
- UI impact
- Desktop/tablet/mobile impact
- Tests/checks
- Risks
- Rollback notes
- Screenshots where relevant
- Stack section

## Automation Expectations

Repository admins should enforce:

- Branch protection for `main`, `master`, `develop`, `staging`, and `release/*`.
- Required pull request reviews.
- Required status checks.
- Conversation resolution before merge.
- No direct pushes to protected branches.
- No force pushes to protected branches.
- CODEOWNERS review for sensitive areas.
- Labels for stack status, module, database impact, and release risk.

See `MULTI_AGENT_DEVELOPMENT.md`, `MIGRATION_GOVERNANCE.md`, and `RELEASE_PROCESS.md` for the full governance model.
