# Stacked PR Governance & Workflow Guide

## Overview
Stacked Pull Requests allow large architectural enhancements to be broken down into small, independently reviewable, and testable pull requests that build on each other in sequence.

---

## 1. Branch Naming & Organization
When creating stacked PRs:
- Use consistent prefixes: `codex/<feature-name>-part1`, `codex/<feature-name>-part2`, etc., or descriptive branch names.
- Base branch targeting:
  - PR #1 targets `main` or `develop`.
  - PR #2 targets branch `PR-1-branch`.
  - PR #3 targets branch `PR-2-branch`.

---

## 2. PR Labeling & Stack Coordination
- Add the `stacked-pr` label to all PRs in the stack.
- Mention the parent PR and overall stack status in the PR description using the [Pull Request Template](file:///.github/PULL_REQUEST_TEMPLATE.md).
- Create a tracking issue (e.g., `[Stack]: <Feature Name>`) linking all pull requests in the stack.

---

## 3. Merging Strategy
1. Review and approve PR #1 first.
2. Merge PR #1 into the base branch (`main` / `develop`).
3. Retarget PR #2 to the base branch, rebase or merge base changes, and ensure CI passes.
4. Repeat in sequence until the entire stack is landed.

---

## 4. Automated Governance Checks
Every PR run executes the `.github/workflows/pr-governance.yml` workflow, enforcing:
- Conventional commit PR title conventions (`feat:`, `fix:`, `docs:`, `[Stack]:`).
- Full TypeScript compilation (`npm run typecheck`).
- Gold and Accounting invariant verification tests (`npm run qa:gold`, `npm run qa:accounting`).
- Clean production SPA build verification (`npm run build`).
