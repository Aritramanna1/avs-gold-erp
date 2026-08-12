# 02. Ornexa 20-Day Implementation Sprint Plan
**Date:** 2026-08-12  

This sprint plan details the day-by-day tasks required to bring Ornexa to full production readiness, integrating our custom features with the audited APPIT workflows.

---

## Sprint Schedule

### Week 1: Core Foundation & POS Checkout
*   **Day 1**: Re-verify all current tables in Supabase. Run database migrations for missing metal ledger indexes.
*   **Day 2**: Implement branch-wise metal rates overrides in [`settings-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/settings-store.ts).
*   **Day 3**: UI Integration of branch rates selection in POS Billing dropdown.
*   **Day 4**: Implement the **Old Gold Appraisal Calculator** inside POS checkout (weight, touch %, and melt-loss deductions).
*   **Day 5**: Conduct end-to-end POS billing testing (gross weight checkout, GST invoice output, ledger verification).

### Week 2: Portals Integration (Karigar & Customer)
*   **Day 6**: Wire SMS/OTP services to [`karigar-login.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/karigar-login.tsx) using Twilio/WhatsApp API.
*   **Day 7**: Connect Karigar portal dashboard to live active job cards list and metal outstanding logs.
*   **Day 8**: Build the Karigar return/scrap submission form inside the portal.
*   **Day 9**: Integrate OTP auth for customer login and dashboard.
*   **Day 10**: Wire customer scheme ledger view and payment history triggers.

### Week 3: Wholesale & Manufacturing Workflows
*   **Day 11**: Create the **Refinery Batches** tracking UI in the main platform shell.
*   **Day 12**: Implement refinery melting loss calculation and raw bar returns inventory update rules.
*   **Day 13**: Connect Hallmark outwards transit status logs. Add HUID input fields on receipt.
*   **Day 14**: Build the multi-stage manufacturing pipeline handoff logs screen.
*   **Day 15**: Implement process-wise wastage check warnings and approval overrides.

### Week 4: AI Brain & Automation Integration
*   **Day 16**: Create the AI Copilot widget on the main executive dashboard page.
*   **Day 17**: Connect the assistant brain to query ledger entries and vault metrics dynamically.
*   **Day 18**: Deploy automated low-stock warnings and overdue Karigar job alerts.
*   **Day 19**: Conduct comprehensive end-to-end integration tests of all portals.
*   **Day 20**: Execute a dry-run daily close process. Sign off for production release.
