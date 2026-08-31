# Ornexa Automated QA Department

Zero-license-cost, open-source QA platform for AVS Gold ERP / Ornexa.

## One-time install (Docker + k6)

```bash
npm run qa:install          # Pull Docker images + verify scanners
npm run qa:install:docker   # Docker images only
```

**Installed via this session:**
- Docker images: Gitleaks, Trivy, Semgrep, OWASP ZAP
- k6 v2.2.0 (winget)
- Lighthouse CI (`@lhci/cli`)
- **Strix** v1.5.3 (`pip install strix-agent`) — AI pentest layer

```bash
pip install strix-agent          # Strix CLI
export STRIX_LLM=gemini/gemini-2.0-flash   # or openai/gpt-4o etc.
export LLM_API_KEY=your-key      # provider API key
npm run qa:security:strix        # quick staging assessment
```

## Quick start

```bash
# Install QA dev dependencies (first time)
npm install

# Fast smoke (typecheck + unit + security + e2e smoke)
npm run qa:smoke

# Full staging suite
npm run qa:full

# Release candidate gate
npm run qa:release
```

## Safety — STAGING ONLY

Active suites (ZAP, **Strix**, k6, payment mutation, destructive workflows) **refuse to run** against production domains listed in `qa/config/production-blocklist.json`.

Set target in `qa/config/qa.env` (copy from `qa.env.example`):

```
QA_BASE_URL=http://localhost:3000
```

## QA workstreams

| ID | Engineer | Tool |
|----|----------|------|
| QA-01 | Functional/E2E | Playwright |
| QA-02 | Unit/Business Logic | Vitest |
| QA-03 | Component/UI | Vitest + RTL + Playwright |
| QA-04 | Visual Regression | Playwright snapshots |
| QA-05 | Accessibility | axe + Pa11y CI |
| QA-06 | Performance | Lighthouse CI |
| QA-07 | Load/Stress | k6 (staging only) |
| QA-08 | Dynamic Security | OWASP ZAP (staging only) |
| QA-08b | AI Pentest | **Strix** (staging only, human review) |
| QA-09 | Static Security | Semgrep CE |
| QA-10 | Dependency Security | Trivy |
| QA-11 | Secret Leakage | Gitleaks |
| QA-12 | Code Quality | SonarQube Community (self-hosted) |
| QA-13 | API | Playwright API + Vitest (Schemathesis when OpenAPI exists) |

## Directory layout

```
qa/
  config/           # blocklist, env template, tool versions
  fixtures/         # tenants, users, run tags
  unit/             # Vitest business logic
  e2e/              # Playwright QA matrix config
  database/         # RLS isolation tests
  security/         # Semgrep, Gitleaks, ZAP configs
  performance/      # Lighthouse, k6
  accessibility/    # axe, Pa11y
  visual/           # baselines + visual specs
  localization/     # i18n audits
  payments/         # Razorpay test-mode idempotency
  scripts/          # orchestrator, guards, tool runners
  reports-output/   # QA_MASTER_REPORT, junit, artifacts
```

## Jenkins (future)

All commands are plain npm scripts — wire the same `npm run qa:*` targets in Jenkins pipelines. See `Jenkinsfile.qa` stub.

## Reports

- `qa/reports-output/QA_MASTER_REPORT.html`
- `qa/reports-output/QA_MASTER_REPORT.json`
- `qa/reports-output/defects/DEFECTS.json`

## Existing E2E

Legacy specs remain in `e2e/tests/` and are executed via the QA Playwright matrix — no per-browser duplicate files.
