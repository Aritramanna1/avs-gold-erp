# Stacked PR Workflow Audit

Audit date: 2026-08-08

## Repository

- Remote: `https://github.com/Aritramanna1/avs-gold-erp.git`
- Local branch at audit time: `master`
- Local rollback base: `12e1405918add2ddb2729fcca62f8a5692c0afb2`
- Remote default branch observed: `origin/master`
- Remote `origin/master` observed: `e580ff669e72ecde839760230504a2e3101aab57`

## Existing Branch Structure

Remote heads observed:

| Branch          | Commit                                     | Notes                               |
| --------------- | ------------------------------------------ | ----------------------------------- |
| `origin/master` | `e580ff669e72ecde839760230504a2e3101aab57` | Only remote head found during audit |

Local branches observed:

| Branch                        | Commit                                     | Notes                                                       |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `master`                      | `12e1405918add2ddb2729fcca62f8a5692c0afb2` | Local rollback to stable tag; diverged from `origin/master` |
| `codex/pre-rollback-20260807` | `e580ff669e72ecde839760230504a2e3101aab57` | Safety branch preserving pre-rollback tip                   |

## Existing PR Structure

`gh pr list --state all --limit 50` returned no pull requests.

## Existing Governance

Before this governance update:

- `CONTRIBUTING.md` existed with basic branch and test guidance.
- No repository-level `.github/PULL_REQUEST_TEMPLATE.md` was present.
- No repository-level `.github/CODEOWNERS` was present.
- No stacked PR workflow document was present.
- No migration queue or migration ownership file was present.
- No GitHub workflow was present to validate PR template sections or migration queue updates.

## Risk Observations

- The repository has no remote `develop`, `staging`, or `release/*` branches yet.
- The local stable rollback and remote `origin/master` are not the same commit.
- Branch protection and GitHub rulesets require GitHub plan or repository visibility support before they can be enforced.
- Existing production deployment state must not be changed by stacked PR governance work.

## Protection Configuration Attempt

After the governance branch was pushed, GitHub branch protection was checked for `master` through the GitHub API. GitHub returned HTTP 403 with:

`Upgrade to GitHub Pro or make this repository public to enable this feature.`

This confirms the repository-side governance files and workflow can be reviewed in PR #1, but technical branch protection cannot be enabled on the current private-repository plan. The intended settings are documented in `docs/GITHUB_PROTECTION_RULES.md` and should be applied as soon as the repository plan or visibility supports them.

## Governance Changes Introduced

This audit supports the non-behavioral governance update that adds:

- `STACKED_PR_WORKFLOW.md`
- `MULTI_AGENT_DEVELOPMENT.md`
- `MIGRATION_GOVERNANCE.md`
- `RELEASE_PROCESS.md`
- `docs/MIGRATION_QUEUE.md`
- `docs/STACKED_PR_EXAMPLE.md`
- `docs/GITHUB_PROTECTION_RULES.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/CODEOWNERS`
- `.github/labeler.yml`
- `.github/workflows/pr-governance.yml`
- `.github/workflows/protected-branch-guard.yml`
- `scripts/apply-branch-protection.mjs`

These files establish the workflow without changing ERP runtime behavior.
