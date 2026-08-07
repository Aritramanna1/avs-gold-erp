# Contributing to AVS Gold ERP

GitHub is the source of truth. No meaningful change should go directly to `main`, `master`, `develop`, `staging`, or `release/*`; every task must go through a branch and pull request.

## Required Workflow

1. Create a branch for every task.
2. Use stacked PRs for larger work instead of one huge PR.
3. Keep one logical implementation slice per PR.
4. Document the parent PR or parent branch in the PR template.
5. Never merge a child PR before its parent.
6. Never force-push protected shared branches.
7. Never deploy stacked feature branches directly to production.

For multi-agent or multi-branch work, open a "Stacked PR Task" issue before creating branches so ownership, dependencies, database impact, and cross-module impact are visible early.

Read the full process before opening work:

- [Stacked PR Workflow](STACKED_PR_WORKFLOW.md)
- [Multi-Agent Development](MULTI_AGENT_DEVELOPMENT.md)
- [Migration Governance](MIGRATION_GOVERNANCE.md)
- [Release Process](RELEASE_PROCESS.md)

## Branch Naming

Use descriptive branch names:

- `feature/<module>-<slice>`
- `fix/<module>-<problem>`
- `perf/<module>-<target>`
- `security/<module>-<control>`
- `docs/<area>-<topic>`
- `chore/<area>-<task>`

For stacked branches, keep a shared prefix:

```text
feature/billing-foundation
feature/billing-posting
feature/billing-ui
feature/billing-reports
```

## Development Standards

- **Clean Architecture**: Keep Supabase PostgreSQL as the only primary data source and use cloud-backed repositories.
- **Business Safety**: Do not bypass the established services, permissions, posting, or audit paths.
- **Database Safety**: Reserve migrations in `docs/MIGRATION_QUEUE.md` before adding SQL files.
- **Strict Linting & Formatting**: Keep code compatible with ESLint and Prettier.
- **Type Safety**: Maintain TypeScript type coverage.

Recommended checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Run focused Playwright tests when the changed workflow has E2E coverage:

```bash
npx playwright test <relevant spec>
```

## Pull Request Requirements

Every PR must use `.github/PULL_REQUEST_TEMPLATE.md` and include:

- Goal
- Module
- Owner
- Parent PR / parent branch
- Depends on
- Stack section
- Files changed
- Business rules affected
- Database, migration, RLS, and permission impact
- Universal Posting Engine impact
- UI and device impact
- Tests/checks
- Risks
- Rollback notes
- Screenshots where relevant

## Repository Safety

This repository has been connected to external project editors. Do not rewrite published history with force pushes, rebases, amended pushed commits, or squashed pushed commits on protected shared branches. Use `--force-with-lease` only on your own unprotected feature branch when updating a stack.
