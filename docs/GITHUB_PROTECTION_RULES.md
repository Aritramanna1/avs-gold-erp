# GitHub Protection Rules

Repository admins should configure these rules in GitHub branch protection or rulesets. This file documents the intended settings; it does not grant production deployment permission.

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
