# MTJ ERP — E2E Test Suite (Playwright)

## Setup

```bash
npm install
npx playwright install --with-deps chromium
cp .env.e2e.example .env.e2e
```

Fill in `.env.e2e` with a **dedicated test account** — never the production/demo
Supabase project or a real user's credentials:

```
# Point at a local dev server (Playwright manages it automatically):
E2E_BASE_URL=http://localhost:3000

# — or — point at a deployed environment (Playwright connects directly and
# does NOT spawn/assume a local server):
# E2E_BASE_URL=https://your-deployed-host.example/

E2E_EMAIL=your-test-account@example.com
E2E_PASSWORD=your-test-account-password
```

`.env.e2e` is gitignored and must never be committed. Tests that require a
session (everything using the `authedPage` fixture) read
`process.env.E2E_EMAIL` / `process.env.E2E_PASSWORD` and **fail immediately
with a clear error** if either is missing — they never fall back to a
hardcoded account and never skip silently.

## Running

```bash
npm run test:e2e            # headless, full suite
npm run test:e2e:headed     # headed (visible browser)
npm run test:e2e:report     # open the last HTML report
```

## What's covered

- `e2e/tests/auth-*.spec.ts` — login, logout, invitation, forgot/reset
  password, OTP login
- `e2e/tests/workers.spec.ts`, `customers.spec.ts` — People module CRUD +
  duplicate-submit prevention
- `e2e/tests/orders.spec.ts`, `jobcards.spec.ts`, `manufacturing-bills.spec.ts`,
  `melt-account.spec.ts`, `inventory.spec.ts`, `billing.spec.ts`
- `e2e/tests/printing.spec.ts` — A4/thermal/PDF print routes, graceful
  not-found handling, no app-shell chrome leaking into print output
- `e2e/tests/reports.spec.ts`, `whatsapp.spec.ts`, `email.spec.ts`
- `e2e/tests/branch-switching.spec.ts`, `role-permissions.spec.ts`,
  `settings.spec.ts`, `hardware.spec.ts`, `language-switching.spec.ts`
- `e2e/tests/navigation.spec.ts`, `search.spec.ts`, `loading-states.spec.ts`,
  `form-validation.spec.ts`

Every test using the `page`/`authedPage` fixtures from `e2e/fixtures/base.ts`
automatically records console errors and uncaught exceptions; call
`expectNoPageErrors(page)` at the end of a test to assert none occurred.

## Reports & artifacts

- HTML report: `e2e/report/index.html` (open via `npm run test:e2e:report`)
- Screenshots on failure, video on failure, and traces on retry are attached
  to the HTML report automatically (see `playwright.config.ts`).

## CI

`playwright.config.ts` detects `process.env.CI` and adjusts retries, worker
count, and adds a GitHub Actions reporter automatically — no separate CI
config is required beyond setting `E2E_EMAIL`/`E2E_PASSWORD`/`E2E_BASE_URL`
as CI secrets/env vars pointing at a non-production test project.
