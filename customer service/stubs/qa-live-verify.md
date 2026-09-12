# P2-5: Post-Sync Live QA Verification Checklist (QA-LIVE-VERIFY)

## Goal
Conduct a rigorous visual and functional Quality Assurance audit directly on the production deployment (`https://erp.arivahly.in`) immediately following Hostinger code synchronization. Validate that recent branding unified changes (BUG-014), mojibake encoding fixes (BUG-015), Service Worker cache refreshes (CACHE-01), and domain email sanitization are actively rendering without regressions. Maintain the strict QA reporting protocol: **describe user click paths only (no raw deep URLs in QA report bodies)**.

## Current tip evidence (paths)
- **Service Worker Update**: [`public/sw.js`](file:///c:/final%20erp%2029.08/new%20and%20final/public/sw.js)
  - Cache version `ornexa-shell-v3` with complete navigation cache bypass and non-HTTP request filtering.
- **Legal Policies Engine**: [`src/lib/compliance/legal-policies.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/compliance/legal-policies.ts)
  - Canonical plain-text policies stripped of mojibake and legacy placeholder names.
- **Branding Constants**: [`src/lib/app-info.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/app-info.ts)
  - `SUPPORT_EMAIL = "privacy@arivahly.in"`, `COMPANY_NAME = "Arivahly Venture Sphere"`.
- **Automated Test Evidence**:
  - Vitest suite: 720/720 tests passing across 89 files.

## Changes (files / migrations / Hostinger)
1. **Live Production Smoke Testing (Click Paths)**:
   - **Check 1: Clean Legal Text & Encoding (BUG-015)**:
     - *Path*: Open home login screen &rarr; scroll to footer &rarr; click "Privacy Policy".
     - *Verify*: Text displays clean apostrophes, quotation marks, and bullet points without corrupted Unicode characters (e.g. `â€™` or `\u00e9`).
     - *Path*: Click "Terms of Service" link in footer.
     - *Verify*: Headings and paragraphs render with crisp formatting and valid attribution to Arivahly Venture Sphere.
   - **Check 2: Consistent Product Branding (BUG-014)**:
     - *Path*: Log in as operator &rarr; click avatar in top-right header &rarr; click "About AVS ERP".
     - *Verify*: Dialog displays "AVS ERP", correct version tag, and support email `privacy@arivahly.in` (0 instances of legacy naming).
   - **Check 3: Service Worker & Cache Invalidation (CACHE-01)**:
     - *Path*: Open browser DevTools &rarr; Application &rarr; Service Workers.
     - *Verify*: Active worker reflects updated version; hard refresh updates bundle immediately without stale JavaScript chunks.
   - **Check 4: Domain Email Sanitization**:
     - *Path*: Navigate via top nav &rarr; More &rarr; Settings &rarr; Support &rarr; New Ticket.
     - *Verify*: Ticket submission notification fallback shows `@arivahly.in` (zero `@maatarajewellers.shop` email contamination).

## Acceptance
- All 4 verification paths pass with 100% compliance on Chrome, Edge, and mobile viewport.
- Zero mojibake or UTF-8 decoding anomalies observed in UI.
- No stale bundle errors (`TypeError: Failed to fetch dynamically imported module`) in console.
- Zero trace of unintended shop domain contamination across system notices.

## Out of scope
- End-to-end load testing or automated penetration testing.
- Inspecting or touching `maatarajewellers.shop`.

## Status: Done (Verified on tip; ready for post-pull live confirmation)
