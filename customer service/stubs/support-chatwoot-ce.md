# P0-6: Chatwoot Community Edition (CE) Self-Hosted Support Desk (AVS-53)

## Goal
Deploy **Chatwoot Community Edition (CE)** as the authoritative **System of Record (SoT)** for AVS Gold ERP customer care and SaaS platform support, running on a dedicated **Hostinger VPS** using Docker containers. Connect Hostinger business email (`support@arivahly.in`) via direct IMAP and SMTP. Ensure customer care operations never burn tenant credits (zero `deduct_tenant_credits`), maintaining an open, low-overhead support channel for jewellery workshop operators.

## Current tip evidence (paths)
- **Customer Care Specification**: [`customer service/customer service.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/customer%20service.md)
  - Section 3 & 4: Establishes Chatwoot CE on Hostinger VPS as the primary long-term platform desk.
- **Platform Architecture Policy**: [`customer service/self-hosted-platform.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/self-hosted-platform.md)
  - Section 2: Hostinger-first hosting; demotes tawk.to to optional external website widget; strictly prohibits hosting support mail on Supabase.
- **In-App Support Desk Components**:
  - Training Centre & Help Agent: [`src/components/help/HelpCenterModal.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/help/HelpCenterModal.tsx)
  - Consumer Support Desk: [`src/components/support/ConsumerSupportDesk.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/support/ConsumerSupportDesk.tsx)
  - Settings Support Tickets: [`src/pages/SupportTicketPage.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/pages/SupportTicketPage.tsx)
- **Credit Rule Invariant**: [`src/stores/credits-store.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/stores/credits-store.ts)
  - SaaS support tickets (`STF-*`) never trigger credit deductions.

## Changes (files / migrations / Hostinger)
1. **Hostinger VPS Docker Deployment Specification**:
   - Create `docker-compose.yml` on Hostinger VPS running:
     - `chatwoot-web` & `chatwoot-worker` (Docker image `chatwoot/chatwoot:latest`)
     - `postgres:14-alpine` (Chatwoot internal DB; independent of Supabase ERP DB)
     - `redis:7-alpine` (Background job queue & cache)
   - Persistent volume mounts for database state and local attachment caching.
2. **Mailbox & Channel Configuration**:
   - **Inbound Channel (IMAP)**:
     - Host: `imap.hostinger.com` | Port: `993` | SSL/TLS: Required
     - User: `support@arivahly.in`
   - **Outbound Channel (SMTP)**:
     - Host: `smtp.hostinger.com` | Port: `465` (SSL) or `587` (STARTTLS)
     - User: `support@arivahly.in`
     - Sender: `AVS Gold Support <support@arivahly.in>`
3. **Storage Configuration**:
   - Media and ticket attachments routed to Cloudflare R2 bucket or local VPS volume (preventing storage bloat on Supabase free tier).
4. **Widget & ERP Hook**:
   - Live website chat inbox configured in Chatwoot for public portals (`aurum.arivahly.in` / `portal.arivahly.in`).
   - Webhook bridge to in-app `ConsumerSupportDesk` for operator notification.

## Acceptance
- Email sent to `support@arivahly.in` ingests cleanly into Chatwoot CE as an incoming conversation.
- Agents can reply from Chatwoot CE interface, and the email is delivered to the customer via Hostinger SMTP with correct SPF/DKIM alignment.
- Chatwoot web widget communicates in real time with the VPS instance.
- Exact **0** credit deduction occurs on any tenant wallet when tickets are raised, updated, or resolved.
- Supabase free database and edge functions remain untouched by customer care email loops.

## Out of scope
- Using Supabase Auth or Supabase Database to host Chatwoot tables.
- Paid Chatwoot "Captain" AI add-ons (parked under `ai-pay-later.md`).
- Deploying Chatwoot containers onto `maatarajewellers.shop`.

## Status: In progress (Deployment architecture drafted; awaiting owner VPS provisioning)
