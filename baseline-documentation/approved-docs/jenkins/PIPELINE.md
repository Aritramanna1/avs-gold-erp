# Jenkins CI/CD — Ornexa / AVS Gold ERP

## Overview

The version-controlled `Jenkinsfile` at the repository root defines the engineering pipeline:

```
Developer Code → Git → Webhook → Jenkins → Validate → Build → (Deploy) → Health Check → Notify
```

## Pipeline stages

| Stage | Purpose |
|-------|---------|
| Checkout | Git clone + commit metadata |
| Environment Validation | Node/npm, lockfile present |
| Install Dependencies | `npm ci` (deterministic) |
| TypeScript | `tsc --noEmit` |
| Lint | `eslint .` |
| Security Scan | `scripts/security-scan.mjs` |
| Service Verification | Assistant + day-1 self-checks |
| Supabase Migration Validation | Non-destructive schema file checks |
| Build | `vite build` → `dist/` artifact |
| Desktop Build | Optional when `electron-app/` exists |
| E2E Playwright | **Gated** — only when `PLAYWRIGHT_E2E_ENABLED=true` |
| Deploy Staging | `PIPELINE_TARGET=staging` on main/develop |
| Deploy Production | Manual approval + `PIPELINE_TARGET=production` |
| Health Check | `HEALTH_CHECK_URL` curl |

## Environments

| Target | Trigger | Deploy |
|--------|---------|--------|
| Development | Feature branches | **Never** auto-deploy |
| Staging | `main` / `develop` / `staging` | Optional staging script |
| Production | Approved tag + parameter | Manual approval gate |

**Never** auto-deploy every commit to production.

## Jenkins setup (server)

1. Install Jenkins LTS + Node.js 22 plugin or tool installer
2. Create multibranch pipeline job pointing at this repo
3. Configure webhook from Git host (GitHub/GitLab) → `buildNow`
4. Add credentials (Credential Binding):

| ID | Type | Used for |
|----|------|----------|
| `supabase-service-role` | Secret text | Deploy/migration (never in repo) |
| `razorpay-key-secret` | Secret text | Billing edge deploy |
| `smtp-ci-notify` | Secret text | `CI_NOTIFY_SMTP_URL` |
| `staging-deploy-token` | Secret text | Staging deploy |
| `production-deploy-token` | Secret text | Production deploy |

5. Set job environment variables:
   - `PLAYWRIGHT_E2E_ENABLED=false` (until PO authorizes)
   - `HEALTH_CHECK_URL` (staging/production URLs)
   - `CI_NOTIFY_FROM`, `CI_NOTIFY_TO`, `CI_NOTIFY_DEPLOY_TO`

## Notifications

Build failure and production deploy success trigger `npm run ci:notify` which sends email when SMTP credentials are configured. WhatsApp can be added later via AVS Communication Platform.

## Local CI mirror

```bash
npm run ci
```

Runs the same validation stages as Jenkins (excluding deploy/E2E).

## E2E gate

Playwright E2E stage exists in the Jenkinsfile but is disabled by default. Product Owner enables by setting:

```
PLAYWRIGHT_E2E_ENABLED=true
```

plus Supabase test credentials in Jenkins.
