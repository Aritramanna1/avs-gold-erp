# Cloudflare Security & Edge Configuration — Online Managed ERP
**Target Domain**: `maatarajewellers.shop`  
**Architecture**: Cloudflare Proxied Edge -> Hostinger Shared Business Origin -> Supabase (PostgreSQL / Auth / RLS) + Cloudflare R2 (Private Media Vault)  
**Security Level**: High / Production Hardened  
**Date**: September 2026

---

## 1. DNS & Edge Proxy Configuration

| Hostname | Type | Target / Value | Proxy Status | SSL/TLS |
| :--- | :--- | :--- | :--- | :--- |
| `@` (`maatarajewellers.shop`) | `CNAME` / `A` | Hostinger Production Web Server | **Proxied (Orange Cloud)** | Full (Strict) |
| `www.maatarajewellers.shop` | `CNAME` | `maatarajewellers.shop` | **Proxied (Orange Cloud)** | Full (Strict) |
| `_dmarc.maatarajewellers.shop` | `TXT` | `v=DMARC1; p=reject; rua=mailto:admin@maatarajewellers.shop` | DNS Only (Grey) | N/A |
| `hostingermail._domainkey` | `TXT` | Hostinger DKIM Public Key | DNS Only (Grey) | N/A |

- **Always Use HTTPS**: Enabled (Automatic 301 redirects from HTTP to HTTPS).
- **Minimum TLS Version**: `TLS 1.2` (TLS 1.3 enabled with 0-RTT turned ON for performance).
- **HSTS**: Enabled (`max-age=31536000; includeSubDomains; preload`).

---

## 2. Crawler & AI Bot Mitigation Policy

### Strict Anti-Crawling Directive
The ERP and its administrative/portal surfaces are closed enterprise software with zero public indexing:
1. **AI Crawl Control**: Enabled in Cloudflare Security dashboard to automatically challenge or drop all AI scraping agents (OpenAI, Anthropic, ByteDance, Common Crawl, Perplexity, FacebookBot, etc.).
2. **Managed `robots.txt`**: Served directly at the root with explicit `Disallow: /` for all AI user-agents and complete disallow of `/app/`, `/company-admin/`, `/platform/`, `/customer-portal/`, `/karigar-portal/`, `/api/`, `/doc/`, `/verify/`, and `/invite/`.
3. **WAF Block Rule for Non-Browser Scrapers**:
   ```sql
   (http.user_agent contains "GPTBot" or 
    http.user_agent contains "ChatGPT-User" or 
    http.user_agent contains "anthropic-ai" or 
    http.user_agent contains "Claude-Web" or 
    http.user_agent contains "Bytespider" or 
    http.user_agent contains "CCBot" or 
    http.user_agent contains "PerplexityBot" or 
    http.user_agent contains "Diffbot")
   -> Action: BLOCK (403 Forbidden)
   ```

---

## 3. Bot Protection & WAF Custom Rules

### Cloudflare Bot Fight Mode
- **Bot Fight Mode**: Active on all public traffic.
- **Super Bot Fight Mode (if Pro/Enterprise plan)**:
  - Definitely Automated: Block
  - Likely Automated: Managed Challenge
  - Verified Search Bots: Restricted to sitemap endpoints only.

### Custom WAF Rules

#### Rule 1: Admin Panel Defense
- **Path Expression**: `(http.request.uri.path starts_with "/company-admin" or http.request.uri.path starts_with "/platform" or http.request.uri.path starts_with "/saas-admin")`
- **Mitigation**: Managed Challenge for suspicious IP reputations or unexpected ASN spikes; rate limit of 60 requests/minute per IP.

#### Rule 2: API Protection & Rate Limiting
- **Path Expression**: `(http.request.uri.path starts_with "/api/")`
- **Exclusions**: Webhooks signed with valid HMAC headers (`/api/webhooks/*`).
- **Rate Limit**:
  - General API: 120 req/min per IP.
  - Authentication `/api/auth/*` & Login: 10 req/min per IP.
  - QR Verification `/api/verify/*` & `/verify/*`: 30 req/min per IP (Allows mobile camera scans while mitigating enumeration).

#### Rule 3: Webhook Exemption & Signature Integrity
- **Path**: `/api/webhooks/dispatcher.php` and `/api/webhooks/*`
- **Rule**: Bypass Cloudflare JS challenge for known webhook provider IP ranges (e.g. Razorpay, Meta WhatsApp Cloud API) ONLY when accompanied by provider-specific signature headers (`x-razorpay-signature`, `x-hub-signature-256`).
- **Verification**: Application-layer HMAC SHA256 validation occurs server-side in PHP with replay protection (timestamp threshold < 300s).

---

## 4. Cache & CDN Edge Rules

To prevent any possibility of cross-tenant cache contamination:

1. **Rule: No-Cache for Dynamic API & Portal State**:
   - Matches: `/api/*`, `/customer-portal/*`, `/karigar-portal/*`, `/company-admin/*`, `/doc/*`
   - Cache Level: **Bypass (Do Not Cache)**
   - Origin Headers Enforced: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private`
2. **Rule: Static Asset Edge Caching**:
   - Matches: `/assets/*`, `*.js`, `*.css`, `*.woff2`, `*.webp`, `*.png`, `*.svg`
   - Cache Level: **Cache Everything (Edge TTL 30 days, Browser TTL 1 year)**
   - Query String Sorting: Enabled.

---

## 5. Storage Security (Cloudflare R2)

- **Bucket Access**: 100% Private (No public bucket URLs, no directory listing).
- **Access Pattern**: Handled server-side through `public/api/storage/r2.php` using S3 AWS SDK v4 signed presigned URLs.
- **Tenant Scope Enforcement**:
  - Keys strictly partitioned: `tenant/<tenant_id>/designs/<file_id>`, `tenant/<tenant_id>/products/<file_id>`, `tenant/<tenant_id>/documents/<file_id>`.
  - Presigned URL lifetime: 3600 seconds (1 hour) max for authorized viewers.
  - Zero browser exposure of Cloudflare R2 Account ID, Access Key ID, or Secret Access Key.

---

## 6. HTTP Security Headers (Edge & Origin)

Both Cloudflare Transform Rules and Hostinger `.htaccess` enforce:
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## 7. Future MCP (Model Context Protocol) Security Contract

> [!IMPORTANT]
> **MCP IS CURRENTLY DISABLED / NOT PUBLIC**.
> No MCP endpoints or tool-execution routers are exposed on `maatarajewellers.shop`.

When MCP is intentionally deployed in a future release, the following architectural contract must be maintained:
1. **Dedicated Hostname**: `mcp.maatarajewellers.shop` or path `/api/mcp/v1/*` behind Cloudflare Access (Zero Trust).
2. **Mutual Auth / Token Auth**: Cryptographic Bearer token with tenant-specific claim and tool-level permission scopes.
3. **Tenant & RLS Enforcement**: MCP agent execution context must map directly to an authorized `organization_id` subject to Supabase RLS and PostgreSQL tenant isolation.
4. **Audit Logging**: Every tool invocation and payload inspection recorded in `admin_audit_logs`.
5. **Rate Limiting**: 20 tool calls per minute per authenticated client.

---

## 8. Summary of Cloudflare Plan Compatibility

- **Cloudflare Free / Pro Tier**: Fully supports the DNS proxy, Full (Strict) SSL, WAF custom rules (up to 5 on Free / 20 on Pro), AI Crawl Control, Bot Fight Mode, Rate Limiting rules, and Page/Cache rules specified above.
- **Verification Status**: Tested and validated against production domain `maatarajewellers.shop`.
