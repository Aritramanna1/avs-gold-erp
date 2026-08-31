# Multi-Agent Development

## Core Rule

Every agent works on a branch. No agent overwrites `main`.

Agents are implementers, not release managers. Only explicit Product Owner
release approval allows a branch to enter `main`.

## Branch Assignment Examples

- Codex: `feature/backend-posting`
- Base44: `feature/mobile-ui`
- Cursor: `feature/report-engine`
- Claude: `feature/assistant`

## Agent Start Checklist

Before changing files:

1. Run `git status --short --branch`.
2. Confirm the branch is not `main`.
3. Pull or fetch the latest remote state.
4. Create a task branch from `develop` unless instructed otherwise.
5. Keep unrelated changes out of the branch.

## Agent Stop Checklist

Before handing off:

1. Run relevant tests or explain why they were not run.
2. Push the task branch.
3. Open a PR into `develop`.
4. Document migrations, release risk, and manual steps.

## Forbidden Without Explicit Approval

- Force pushing any shared branch.
- Resetting `main`, `develop`, or `staging` to an older commit.
- Replacing production from a feature branch.
- Mixing unrelated tasks into one branch.
- Deleting release tags or backup branches.
