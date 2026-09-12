# P1-6: Fleet Infrastructure — DNS and SSL Resolution for Subdomains (OPS-DNS-SSL)

## Goal
Resolve DNS routing and SSL certificate issues for secondary subdomains in the AVS ecosystem (`aurum.arivahly.in` and `portal.arivahly.in`). Ensure both subdomains resolve over valid, auto-renewing HTTPS certificates (Let's Encrypt / Hostinger SSL) so that customer-facing marketing pages, public customer portals, and embedded support widgets operate cleanly without browser security warnings.

## Current tip evidence (paths)
- **Surfaces Inventory**: [`customer service/00-PROJECT-SCOPE.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/00-PROJECT-SCOPE.md#L21)
  - Documents `aurum.arivahly.in` (SSL broken) and `portal.arivahly.in` (DNS pending).
- **Public Domain Helper**: [`src/lib/website/public-site-url.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/website/public-site-url.ts)
  - Formulates absolute URLs for public customer, karigar, and document verification portals.
- **Risk Assessment**: [`customer service/customer service.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/customer%20service.md#L198)
  - Notes that public chat widgets cannot function effectively until `aurum` SSL and `portal` DNS are active.

## Changes (files / migrations / Hostinger)
1. **Hostinger DNS Zone Editor (`arivahly.in`)**:
   - **`aurum.arivahly.in`**:
     - Type: `A` / `CNAME` pointing to Hostinger web hosting / VPS IP.
     - TTL: `14400` (standard).
   - **`portal.arivahly.in`**:
     - Type: `CNAME` &rarr; `erp.arivahly.in` (or corresponding hosting A record).
2. **Hostinger hPanel SSL Management**:
   - Navigate to **Security** &rarr; **SSL**:
     - Reinstall / activate Let's Encrypt SSL certificate for `aurum.arivahly.in`.
     - Enable "Force HTTPS" redirect toggle.
     - Activate wildcard SSL or individual certificate for `portal.arivahly.in`.
3. **Web Server VirtualHost Check**:
   - Ensure LiteSpeed / Nginx configuration properly binds the server names and points to their respective web root directories without SSL handshake errors.

## Acceptance
- `https://aurum.arivahly.in` loads over HTTPS with a valid green certificate lock icon (no `ERR_CERT_COMMON_NAME_INVALID` or `SSL_ERROR_BAD_CERT_DOMAIN`).
- `https://portal.arivahly.in` resolves cleanly to the customer/karigar portal interface.
- Embedded chat widgets load assets over HTTPS without mixed-content blocking.

## Out of scope
- Modifying DNS records for `maatarajewellers.shop`.
- Purchasing expensive third-party enterprise SSL certificates (free automated Let's Encrypt via Hostinger is sufficient).

## Status: In progress (Awaiting owner hPanel action on aurum & portal SSL/DNS)
