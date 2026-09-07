# AVS ERP Model Context Protocol — Security & Trust Model

Architectural guidelines, authorization invariants, and tenant isolation policies governing remote MCP execution.

---

## 1. Core Principles

1. **One ERP, One Business Logic**: MCP tool handlers strictly dispatch through domain stores (`DualLedger`, `WorkerGoldBook`, `CalculationEngine`, `BillingStore`). Direct database alteration is architecturally prohibited.
2. **Gold-First Dual-Dimension Invariance**: Fine Gold (@ 995 basis) and Cash (₹ paise) are discrete mathematical entities. Responses never collapse them into a single currency number.
3. **Zero Secret Exposure**: Passwords, Supabase service-role keys, R2 secret access keys, Razorpay keys, and bearer tokens are never output in JSON-RPC responses or saved in audit logs.

---

## 2. Multi-Tenant Isolation
* Every request must resolve caller `tenant_id`, `branch_id`, and `role`.
* Any attempt to query or mutate an entity belonging to a foreign tenant results in an immediate `TENANT_ACCESS_DENIED` error (`HTTP 403`).

---

## 3. Risk Classification & Confirmation Gates

| Classification | Action Policy | Example Tools |
| :--- | :--- | :--- |
| **READ** | Allowed when caller has appropriate read permission. | `server/health`, `core.get_system_status`, `finance.get_account_balance`, `stock.search_stock` |
| **WRITE** | Allowed when authorized; enforces idempotency. | Draft order creation, customer KYC update |
| **HIGH_RISK** | **PREPARE-only mode**; requires explicit user confirmation and Supervisor SMS OTP. | `karigar.prepare_karigar_settlement`, period locks, bullion rate overrides |

---

## 4. Rate Limiting & Abuse Prevention
* Per-token rate limit: 60 requests/minute (burst: 120/minute).
* Replay attack prevention via `X-Idempotency-Key` caching.
* Cloudflare WAF protections against cross-tenant probing and brute force attacks.
