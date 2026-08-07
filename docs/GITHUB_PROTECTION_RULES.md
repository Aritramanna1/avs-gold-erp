# GitHub Protection Rules

Repository admins should configure these rules in GitHub branch protection or rulesets. This file documents the intended settings; it does not grant production deployment permission.

## Current Enforcement Status

As of 2026-08-08, this private repository does not allow branch protection or ruleset configuration through the GitHub API on the current plan. Attempts to read or write protection for `master` return:

`Upgrade to GitHub Pro or make this repository public to enable this feature.`

Until the repository plan or visibility supports protected branches, the enforceable controls in this PR are:

- Pull request template requirements.
- PR governance checks for required sections, completed stack metadata, and migration queue updates.
- CODEOWNERS routing metadata.
- Automatic PR labels backed by `.github/labels.yml`.
- Protected Branch Guard workflow visibility for direct pushes to shared branches.
- Documented protected-flow policy.

To apply the repository labels used by the PR labeler:

```sh
npm run github:sync-labels
```

When GitHub enables branch protection for this repository, apply the settings below before treating `main`, `master`, `develop`, `staging`, or `release/*` as technically protected.

To apply the repeatable branch-protection configuration after GitHub enables the feature:

```sh
npm run github:protect-branches
```

The script protects `master`, `develop`, and `staging`. Configure `release/*` through a GitHub ruleset when rulesets are available, because classic branch protection applies to concrete branch names.

## Protected Branch Patterns

- `main`
- `master`
- `develop`
- `staging`
- `release/*`

## Required Settings

- Require a pull request before merging.
- Require approvals.
- Require CODEOWNERS review.
- Require conversation resolution before merging.
- Require status checks to pass.
- Require branches to be up to date before merging.
- Block force pushes.
- Block branch deletion.
- Restrict direct pushes to repository admins only, or disable direct pushes entirely.

## Required Checks

At minimum:

- `PR Governance / Validate PR template`
- `PR Governance / Validate migration queue`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Relevant E2E checks for the affected module.

## Higher-Risk Review Rule

Require two approvals for changes touching:

- `supabase/**`
- `src/integrations/supabase/**`
- `src/lib/repositories/**`
- `src/lib/rbac.ts`
- `src/lib/permissions.ts`
- `src/modules/billing/**`
- Posting, ledger, settlement, invoice, payment, or gold-balance code.

## Stack Merge Rule

Before merging any stacked PR, confirm:

- Parent PR is merged or this PR is still targeting its parent branch.
- No child PR is merged ahead of this PR.
- PR description's Stack section is current.
- Migration queue has no conflicting active reservation.
