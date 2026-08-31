# Ornexa / AVS Gold ERP — Strix Authorized Staging Assessment Scope

**Classification:** INTERNAL QA — TEST/STAGING ONLY  
**Human review required:** All Strix findings MUST be reviewed by Product Owner / security lead before any code change.  
**No auto-remediation:** Do not apply fixes automatically from agent output.

## Authorized targets

- Web app base URL: `${QA_BASE_URL}` (localhost or approved staging host ONLY)
- Source repository: white-box analysis of `src/`, `supabase/functions/`, `supabase/migrations/` (read-only reasoning; do not modify files)
- Supabase REST/RPC surface exposed to the browser client (project: test/staging)

## Explicitly FORBIDDEN targets (stop if encountered)

- `maatarajewellers.shop` and any production Ornexa domain
- Razorpay live API (`api.razorpay.com` with live keys) — TEST webhook simulation only inside our app boundary
- Meta / WhatsApp Cloud API / Gmail / external BSP endpoints
- Any third-party SaaS not owned by AVS
- Denial-of-service, load flooding, or resource exhaustion attacks
- Data destruction, mass deletion, or schema drops

## Attack surfaces to test

### Unauthenticated
- Login, password reset, invite accept, public document share (`/doc/:token`), verify routes
- Header security (CSP, HSTS on staging build), cookie flags, CORS on edge functions
- Information disclosure in static assets, error pages, source maps
- XSS in reflected/stored inputs on public routes
- SSRF via any URL-fetching edge functions (if present)
- Secret leakage in client bundles (service-role keys, webhook secrets)

### Authenticated (ERP)
Use **Tenant A** credentials from environment (Owner/Admin). Test:
- IDOR: changing firm_id / party_id / order_id in API requests
- Branch-restricted user accessing another branch
- Role escalation (Manager → Owner-only routes)
- Platform Owner tables inaccessible to tenant users
- Gold ledger / manufacturing costing hidden from Customer portal sessions

### Portals
Separate sessions for Customer, Karigar, Supplier portals (Tenant A accounts):
- Customer A MUST NOT read Customer B orders/invoices
- Karigar A MUST NOT read Firm B job cards or gold books
- Supplier A MUST NOT read Supplier B purchase data
- Portal must not expose internal profitability, worker rates, or unrestricted PII

### Payments (Razorpay TEST MODE ONLY)
- Payment link creation, webhook handler idempotency (duplicate event must not double-credit)
- Do NOT call Razorpay production APIs or use live keys
- Validate webhook signature enforcement in `supabase/functions/razorpay-webhook`

### File upload / R2
- Upload path traversal, MIME spoofing, oversized files
- Storage RLS: Tenant A object keys not readable by Tenant B JWT
- Presigned URL scope and expiry

### Business logic
- Gold conservation: issue/receive/transfer must not allow negative custody via API tampering
- Customization: published formula version pinning
- Credits / entitlements: duplicate fulfilment on replayed webhooks

## Tenant isolation matrix (mandatory checks)

| Actor | Must NOT access |
|-------|-----------------|
| Karigar Tenant A | Firm B manufacturing, other karigar books |
| Customer Tenant A | Customer B portal data |
| Supplier Tenant A | Supplier B portal data |
| Branch-restricted user | Other branch records |
| Tenant user | `platform_*` tables, other firms |

## Credentials

Loaded from `qa/security/strix/accounts.env` (gitignored).  
If Tenant B accounts are missing, report as **BLOCKED** for cross-tenant tests — do not guess IDs.

## Evidence requirements

For each confirmed finding provide:
- Severity (map to P0–P4)
- Reproduction steps (sanitized)
- HTTP request/response excerpts with secrets redacted
- Affected route/RPC/table
- Suggested remediation (human-reviewed)

## Severity mapping

- **P0:** Cross-tenant data leak, auth bypass, secret exposure, payment double-fulfilment
- **P1:** Broken access control on critical workflow (gold, billing, portal)
- **P2:** Injection/XSS with realistic exploit path, SSRF to internal metadata
- **P3:** Missing headers, verbose errors, low-impact IDOR on non-sensitive data
- **P4:** Informational / hardening
