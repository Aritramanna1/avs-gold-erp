# P2-4: Optional External Tawk.to Widget (Non-SoT Marketing Stopgap)

## Goal
Document the role and non-authoritative boundary of the **tawk.to live chat widget** within the AVS Gold ERP ecosystem. Reiterate that tawk.to is strictly an **optional, temporary marketing stopgap** for external visitor inquiries on public marketing surfaces (`aurum.arivahly.in`), and is **EXPLICITLY NOT the platform support System of Record (SoT)**. The authoritative platform support desk is self-hosted **Chatwoot CE on Hostinger VPS** connected to Hostinger business email (`support@arivahly.in`).

## Current tip evidence (paths)
- **Architecture Policy**: [`customer service/self-hosted-platform.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/self-hosted-platform.md#L30)
  - Section 2: Explicitly demotes tawk.to to optional temporary marketing widget; marks Chatwoot CE as authoritative.
- **Customer Care Guide**: [`customer service/customer service.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/customer%20service.md#L45)
  - Details cost models and comparative tradeoffs.
- **Tawk Integration Code (Merged in PR #27 / AVS-52)**:
  - Widget loader: `src/components/support/TawkChatWidget.tsx` (or website index embed)
  - Property ID configuration: Expects `VITE_TAWK_PROPERTY_ID` and `VITE_TAWK_WIDGET_ID` in environment variables.

## Changes (files / migrations / Hostinger)
1. **Source Code & Widget Management**:
   - Keep widget dynamically conditional: loads only if valid property ID exists in environment and user is on a public marketing surface.
   - Do NOT embed tawk.to inside the core authenticated operator app shell (`/app`, `/billing`, `/workshop`), where `HelpCenterModal` and `ConsumerSupportDesk` provide context-aware, zero-credit support.
2. **Data & Privacy Boundary**:
   - No authenticated ERP operator session tokens, customer phone numbers, or ledger balances may be transmitted to external tawk.to servers.

## Acceptance
- If environment variables are omitted, the application boots cleanly with 0 console errors and 0 third-party network requests to tawk.to.
- If enabled on marketing pages, the chat bubble renders for public prospective customers.
- Operator support tickets and official warranty disputes are never routed through or stored solely in tawk.to.
- Chatwoot CE remains the authoritative platform support desk.

## Out of scope
- Purchasing paid tawk.to add-ons (white-labeling, AI Assist, hired human agents).
- Treating tawk.to chat logs as authoritative records for billing or gold balance dispute arbitration.

## Status: Done (Integration code merged; classified as non-SoT marketing stopgap)
