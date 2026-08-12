# AVS-9 QA, Maintainability, and Release Gate Audit

Date: 2026-08-12
Agent: QA & Reliability Engineer
Scope: AVS-5C read-only audit. No source code, migration, production data, deployment, reset, rebase, or force-push action was performed.

## Executive Finding

AVS-5 must remain release-gated. The repository has useful process documents, broad e2e coverage, and a version-safety workflow, but the current automated gates are not sufficient for a production-grade jewellery manufacturing ERP.

The safe reviewer posture for future AVS-5 PRs is fail-closed: a PR may merge only when its affected business rule is traceable to an approved requirement, its tenant/security behavior is proven, its accounting deltas reconcile, and verification evidence is attached to the PR.

## Current Local Verification

| Check | Result | Evidence / Limitation |
|---|---|---|
| Git branch/state | Warning | Active workspace is on `antigravity`; unrelated untracked GST/report files already exist and were not modified by this audit. |
| Dependency install state | Pass | `node_modules` is present in this checkout. |
| `npm run typecheck` | Pass | `tsc --noEmit` completed successfully on 2026-08-12. |
| `npm run security:scan` | Pass | `Client security scan passed: no privileged-key patterns found in src/dist.` |
| Build | Not run | This audit used the smallest local verification set needed to correct the stale handoff evidence. |
| e2e | Not run | Live multi-tenant test environment, credentials, and target release scope were not exercised in this local correction. |

## Evidence Reviewed

- `TESTING.md`
- `RELEASE_PROCESS.md`
- `BRANCHING_STRATEGY.md`
- `.github/workflows/version-safety.yml`
- `.github/pull_request_template.md`
- `.github/CODEOWNERS`
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/DEPLOYMENT_READINESS_REPORT.md`
- `docs/TARGET_RLS_POLICY_DIFF.md`
- `package.json`

## Release-Blocking Risks

| Severity | Area | Finding | Required Gate |
|---|---|---|---|
| P0 | Tenant isolation | Prior readiness materials identify tenant onboarding/RLS as partial or unsafe, including permissive policies and incomplete authenticated RLS tests. | Block production until two controlled tenants prove own-tenant allow paths and cross-tenant deny paths for reads, writes, storage, document shares, portal access, support tickets, and branch-scoped data. |
| P0 | Target backend readiness | Target schema, storage policy, and migration history require reconciliation before production reliance. | Block production until target schema diff, migration review, storage bucket policy proof, and RLS test artifacts are attached. |
| P0 | Gold/accounting traceability | Gold ledger, workshop processes, material vault, worker books, and audit logging require invariant proof for affected changes. | Block affected PRs unless ledger deltas are atomic or covered by reconciliation evidence showing no orphan workflow rows, orphan ledger rows, or branch/firm drift. |
| P0 | Release branch safety | Repo policy says `main` is the approved release branch and Product Owner approval is required before replacing it. | All implementation work must occur on task branches targeting `develop`, then `release/<version>`, then `main` only after Product Owner approval. |
| P1 | Conflicting readiness evidence | Older reports contain production-ready or pilot-ready language while newer security and traceability evidence marks major gates partial/unsafe. | Reviewers must treat current traceability and target reconciliation artifacts as controlling until superseded by dated approval evidence. |
| P1 | Requirements authority gap | The implementation matrix references a master requirement source; release reviewers need that authority available or formally replaced. | Do not close AVS-5 as complete until the master requirement source is restored or a dated replacement is approved. |
| P1 | Business-rule ambiguity | GST base, making charge formula, delivery challan conversion, and karigar wastage/settlement ownership are high-risk accounting decisions. | Any PR touching these areas requires an explicit product/accounting decision record before implementation approval. |
| P1 | CI coverage gap | Current automation emphasizes branch naming plus typecheck/build; it does not prove live RLS, migrations, storage policies, e2e, or accounting fixtures. | Required gates must be manually evidenced now or added to CI before relying on automation. |
| P2 | Maintainability | Domain boundaries around platform, customer portal, communications, settings, and Supabase payloads need typed contract discipline. | New PRs must not add untyped domain boundaries; high-risk areas need typed RPC payloads and fixture-backed parsing. |

## Minimum Pass / Fail Gates for Future AVS-5 PRs

| Gate | Pass Criteria | Fail Criteria |
|---|---|---|
| Branch gate | Source branch uses `feature/*`, `fix/*`, `security/*`, `perf/*`, or an approved agent branch; base is `develop` except approved `release/*` or `hotfix/*`; no direct work on `main`. | PR targets `main` from a non-release/hotfix branch, includes direct `main` commits, rewrites pushed history, or lacks branch/base disclosure. |
| Requirement traceability gate | PR cites matrix row, approved issue, and affected business rule. Status is not upgraded based only on route/file existence. | Requirement source is missing, contradicted, or guessed; PR changes accounting/tax/workflow rules without decision evidence. |
| Tenant/security gate | Auth, role, firm, branch, storage, portal, and document-share access paths are tested for both allow and deny cases where touched. Source/bundle secret scan is clean. | Any broad RLS policy, service role exposure, tenant bypass, cross-tenant read/write/storage leak, or unredacted secret path remains. |
| Data migration gate | Migration is additive or explicitly reviewed; rollback/quarantine plan exists; target migration history is understood; no production mutation without approval. | Migration repair is attempted before equivalence is proven; destructive schema/data change lacks backup and Product Owner approval. |
| Ledger invariant gate | Gold/cash/material deltas reconcile against source records with deterministic fixtures. Reversal, void, and cancel paths are included where relevant. | Workflow can leave orphan ledger/business rows, unbalanced gold, duplicate document numbers, or branch mismatch. |
| Test gate | At minimum: `npm ci`, `npm run typecheck`, `npm run build`, `npm run security:scan`, targeted unit/selfcheck/e2e tests, and live staging checks for backend/RLS changes. | Tests are skipped without explicit approval, run only locally against mocks for live-backend behavior, or fail with unexplained warnings in affected areas. |
| UX regression gate | Approved UI/UX patterns, role navigation, loading/error/empty states, print/PDF layout, and mobile drawer behavior are preserved for touched routes. | New partial workflows expose broken actions, console errors, overlapping text, blank print pages, or unapproved Coming Soon changes. |
| Evidence gate | PR includes commands, environment, tenant IDs or fixture names, screenshots/logs for live checks, migration IDs, and rollback criteria. | Reviewer must infer verification from prose, stale reports, or undocumented manual testing. |
| Release approval gate | PR into `main` includes explicit Product Owner approval note/link and immutable release tag plan. | Release PR lacks approval, uses old readiness reports as current approval, or deploys from non-`main` branch. |

## Recommended Reviewer Workflow

1. Confirm branch/base first. Reject direct `main` work except approved release/hotfix flow.
2. Read the linked requirement row and decision record before reviewing code.
3. Classify the PR risk: security/tenant, ledger/accounting, migration, UX-only, or docs-only.
4. Demand the matching evidence gate before reviewing polish.
5. For backend or Supabase work, review RLS `USING` and `WITH CHECK` behavior separately for select, insert, update, and delete.
6. For gold/accounting work, trace every write to its balancing entry, audit entry, reversal behavior, branch stamp, and firm stamp.
7. For UI work, run the route as each affected role and verify denied states, empty states, loading states, print/share links, and console output.
8. Check that old production-ready claims are not used as current evidence unless they are revalidated against the target environment.
9. Require rollback criteria before merge: migration rollback/quarantine path, feature flag/module entitlement fallback, and data repair plan for partial writes.
10. Approve only after the PR template is complete and all required gates are green or explicitly waived by the Product Owner/Engineering Lead with a dated note.

## Fixture Coverage Required Before Release

| Fixture Set | Required Coverage |
|---|---|
| Two-tenant isolation | Owner/admin/staff/viewer/customer in Firm A and Firm B; allowed own-firm actions; denied cross-firm reads/writes/storage; SaaS admin metadata-only behavior. |
| Branch accounting | Two branches per firm; gold ledger, inventory, worker transactions, material vault, billing sequences, and reports agree on top-level `branch_id` and JSON branch metadata. |
| Karigar gold cycle | Issue, partial receive, scrap/filing recovery, wastage/loss, overloss, settlement, void/reversal, passbook impact, and print slips. |
| Billing/GST | CGST/SGST, IGST, discounts, old-gold exchange, mixed payment, credit/debit note, cancellation, document numbering, print/PDF/share token. |
| Document and storage security | KYC attachments, invoices/challans/statements/material slips, signed/public token access, expiry, customer portal identity mapping, denied path traversal. |
| Reports/reconciliation | Daily close, month close, gold summary, gold position, vault reconciliation, settlement reconciliation, inventory ageing, exports and print. |
| Communications/support | WhatsApp/email/SMS provider configuration, redacted secrets, retry/status, audit log, customer support ticket lifecycle, internal-message exclusion. |
| Backup/restore | Backup creation, checksum validation, restore drill, RPO/RTO evidence, corrupted backup rejection, post-restore reconciliation. |

## Recommended CI / Automation Additions

- Add `npm run lint` and `npm run security:scan` to GitHub Actions.
- Add targeted Playwright smoke shards for auth, navigation, billing, orders/workshop, customer portal, and document-share denial.
- Add a non-mutating Supabase readiness script that checks broad policies, nullable `firm_id` on protected tables, bucket existence, storage policies, and exposed privileged functions.
- Add deterministic accounting fixture tests for gold/material/cash reconciliation.
- Add PR checklist enforcement for migration impact, security impact, and release approval fields.

## Rollback and Release Criteria

Release candidate rollback criteria:

- Any cross-tenant data exposure or storage leak.
- Any unbalanced gold/material/cash fixture after a completed workflow.
- Any migration that cannot be reapplied idempotently in staging or lacks a documented rollback/quarantine path.
- Any production bundle secret scan hit for service keys, database URLs, or provider secrets.
- Any print/PDF/share route that exposes another tenant/customer document.
- Any release PR into `main` without explicit Product Owner approval.

Release can proceed only after the current target environment has fresh evidence for typecheck, build, security scan, required e2e shards, RLS/storage checks, migration status, backup/restore drill, and Product Owner approval.

## Final Disposition

AVS-9 audit artifact is complete in this checkout. It does not certify AVS-5 for production. It defines the minimum QA, maintainability, reviewer, and release gates required before future AVS-5 implementation PRs can be considered releasable.
