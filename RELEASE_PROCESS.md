# Release Process

Production releases are explicit. A reviewed PR is not permission to deploy production.

## Promotion Path

```text
feature/fix/perf/security branch
  -> PR review
  -> develop
  -> staging
  -> release/*
  -> explicit approval
  -> main/master
  -> production
```

## Protected Branches

Protect:

- `main`
- `master`
- `develop`
- `staging`
- `release/*`

Required settings:

- Pull request required before merge.
- At least one approval; two approvals for database, RLS, auth, billing, posting, or release changes.
- Required status checks.
- Conversation resolution required.
- No direct pushes.
- No force pushes.
- No branch deletion by non-admins.
- CODEOWNERS review required.

## Release Branches

Create release branches only from `staging`:

```sh
git fetch origin
git switch staging
git pull --ff-only
git switch -c release/2026-08-08-v1.1.1
git push -u origin release/2026-08-08-v1.1.1
```

Release PRs must include:

- Included PRs.
- Excluded stacked PRs.
- Database migrations included.
- Rollback plan.
- Smoke test evidence.
- Explicit deployment approval.

## Deployment Rules

- Do not deploy a feature branch directly to production.
- Do not deploy a child PR while parent PRs are unmerged.
- Do not deploy if database migrations are queued but unapplied.
- Do not deploy with failing checks.
- Do not deploy from local uncommitted changes.

## Rollback

Every release PR must describe:

- Last known good tag or commit.
- Database rollback or forward-recovery strategy.
- Config changes needed to restore service.
- Feature flags or temporary disables, if available.
