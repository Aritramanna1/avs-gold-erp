# P1-4: Grok Bot Support Triage & SAFE/ESCALATE Protocol (AVS-49)

## Goal
Establish an automated intake and triage pipeline for incoming customer care tickets using Grok Bot desks. Provide instant, high-confidence assistance for routine user queries (navigation paths, printing troubleshooting, UI questions) while strictly escalating any inquiry involving gold weights, accounting entries, GST/tax filings, or tenant security to human engineers. Guarantee **exact 0 tenant credit burn** (`deduct_tenant_credits = 0`) across all SaaS customer service workflows.

## Current tip evidence (paths)
- **Specification & Allowlist**: [`customer service/customer service.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/customer%20service.md#L133)
  - Section 6: Comprehensive SAFE vs ESCALATE matrix.
- **In-App Consumer Support Desk**: [`src/components/support/ConsumerSupportDesk.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/support/ConsumerSupportDesk.tsx)
  - Category picker and FAQ stub engine.
- **Support Ticket API & RPCs**: [`src/pages/SupportTicketPage.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/pages/SupportTicketPage.tsx)
- **Credit Store Safety Lock**: [`src/stores/credits-store.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/stores/credits-store.ts)
  - Enforces zero deduction for platform help desk operations.

## Changes (files / migrations / Hostinger)
1. **Triage Allowlist Matrix**:
   - **SAFE (Automated Response Allowed)**:
     - **Navigation & Path Guidance**: Explaining where features reside using icon + word terminology (e.g. *“Artisan settlements live under Make &rarr; Workshop”*).
     - **Hardware & Printing**: WebUSB/RawPrint printer power, USB permissions, barcode tag alignment.
     - **Login UX**: Session expiration guidance, clear cache instructions (no automated password resetting).
     - **Knowledge Base Citations**: Direct links to Training Centre (`/help`).
   - **ESCALATE (Mandatory Human Transfer — Zero Automated Action)**:
     - Gold weight, purity, touch (tanch), or wastage calculation disputes.
     - GST returns, IRN generation, e-invoicing errors, or tax filing questions.
     - Payment disputes, refund status, or credit pack purchase failures.
     - Role-based access control (RBAC), PIN resets, or SaaS Admin permissions.
     - Security alerts, tenant isolation questions, or data deletion requests.
     - Anything requiring an automated database write, RPC mutation, or code PR.
2. **Standard Bot Reply Format**:
   - *Line 1*: Direct 1-sentence answer from approved FAQ knowledge.
   - *Line 2*: Click-path using canonical navigation words (*Home &rarr; Sell &rarr; Customers &rarr; Stock &rarr; Make &rarr; Money &rarr; Reports &rarr; More*).
   - *Line 3*: Standard escalation offer: *"Still stuck? I will keep your support ticket for a human specialist."*
3. **Credit Exemption**:
   - Zero invocation of billing credit meter for bot triage executions.

## Acceptance
- Incoming FAQ queries receive safe canned answers with exact navigation paths within seconds.
- Any ticket mentioning keywords ("gold weight", "wastage dispute", "GST error", "IRN failed", "refund") is immediately tagged `ESCALATE` and assigned to human staff.
- Bot never executes database mutations, financial writes, or ledger entries.
- Tenant credit balance remains completely untouched before, during, and after ticket interactions.

## Out of scope
- Autonomous AI execution of accounting reconciliations or metal adjustments.
- Paid third-party AI assist bots (Chatwoot Captain / Crisp Hugo / tawk AI).

## Status: In progress (Protocol defined; integration with Chatwoot webhook queued)
