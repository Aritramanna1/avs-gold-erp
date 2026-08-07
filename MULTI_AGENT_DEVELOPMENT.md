# Multi-Agent Development

Multiple AI agents and human developers may work in parallel, but ownership must be explicit. Agents do not casually edit another agent's stack.

## Ownership Model

Prefer one owner per stack or logical module:

```text
Agent A
  feature/assistant-core
  feature/assistant-tools
  feature/assistant-ui

Agent B
  feature/payroll-domain
  feature/payroll-posting
  feature/payroll-ui

Agent C
  feature/customer-portal-backend
  feature/customer-portal-ui
```

## Rules

1. Claim ownership in the PR description.
2. Keep work inside the claimed stack unless a cross-module change is documented.
3. Do not edit another stack without coordination in the PR.
4. Never treat "finish the ERP" as permission to merge or deploy production.
5. Use stacked PRs for larger features instead of one huge PR.
6. Keep generated files, migrations, and shared services synchronized with the parent PR.

For new multi-agent work, open a "Stacked PR Task" issue before creating branches. The issue records owner, module, proposed stack, dependencies, database impact, and cross-module impact so two agents do not silently claim the same surface area.

## Cross-Module Changes

Cross-module work must list:

- Why the change crosses modules.
- Which owners were notified.
- Which files are shared contracts.
- Which dependent stacks must rebase.
- Whether the Universal Posting Engine, permissions, RLS, or migrations are affected.

## Handoff Checklist

Before another agent continues a stack:

- Pull the latest parent branch.
- Read the parent PR and all child PR descriptions.
- Check `docs/MIGRATION_QUEUE.md`.
- Check unresolved review comments.
- Run the tests listed in the PR template.
- Update the PR if ownership changes.

## Conflict Policy

If two stacks need the same shared file:

1. Prefer extracting the shared change into a lower foundation PR.
2. Rebase both stacks onto that foundation.
3. Document the dependency in each PR.
4. Do not duplicate incompatible changes in separate stacks.
