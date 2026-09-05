# Public Website to ERP Authoritative Payment & Subscription Contract (v1)

**Document Version:** `1.0.0`  
**Status:** `FINAL APPROVED`  
**Authority:** `Online Managed ERP (https://erp.arivahly.in)`  
**Consumer:** `Public Website & Payment Layer (https://arivahly.in)`  
**Protocol:** `HTTPS / JSON REST (Server-to-Server)`

---

## 1. Architecture Overview & Single Source of Truth

The **Online Managed ERP** is the **exclusive, authoritative source of truth** for:
- Tenant definitions and tenant lifecycle status
- SaaS commercial plans, versions, pricing, and currency
- Subscription states (`trial`, `active`, `past_due`, `suspended`, `cancelled`, `expired`)
- Billing intervals, renewal cycles, and trial/grace periods
- Quotas, capacity limits, and module entitlements
- Invoices, payments, fulfillments, and official receipts

The **Public Website** acts solely as the **public presentation and client checkout interface**. It:
1. Queries the ERP for authoritative plan pricing and tenant subscription status.
2. Requests the ERP to create an authoritative checkout session & invoice before opening payment gateways.
3. Submits payment verification results back to the ERP.
4. **Never** defines pricing, alters subscriptions directly, or accesses internal ERP databases.

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│         PUBLIC WEBSITE          │                 │        ONLINE MANAGED ERP       │
│      (https://arivahly.in)      │                 │     (https://erp.arivahly.in)   │
└────────────────┬────────────────┘                 └────────────────┬────────────────┘
                 │                                                   │
                 │  1. GET /plans (Authoritative Prices)             │
                 ├──────────────────────────────────────────────────►│
                 │  ◄────────────────────────────────────────────────┤
                 │                                                   │
                 │  2. POST /checkout/session (Create Order)         │
                 ├──────────────────────────────────────────────────►│
                 │  ◄────────────────────────────────────────────────┤
                 │     (Returns Razorpay Order & Invoice ID)         │
                 │                                                   │
                 │  [Customer completes Razorpay Payment]           │
                 │                                                   │
                 │  3. POST /payment/verify (Verified Result)        │
                 ├──────────────────────────────────────────────────►│
                 │  ◄────────────────────────────────────────────────┤
                 │     (Idempotent Fulfillment, Entitlements Active) │
                 │                                                   │
```

---

## 2. Server-to-Server (S2S) Authentication

All requests from the Public Website backend to the ERP S2S API must be executed server-to-server and include the following security headers:

| Header Name | Type | Description |
| :--- | :--- | :--- |
| `X-AVS-Service-Key` | `String` | Dedicated server-to-server API Service Key ID (e.g. `avs_svc_pubsite_prod_v1`) |
| `X-AVS-Timestamp` | `Integer` | Current UTC Unix epoch in milliseconds (`Date.now()`). Drift tolerance: **±300 seconds (5 minutes)** |
| `X-AVS-Signature` | `String` *(Optional / Recommended)* | HMAC-SHA256 signature of `${timestamp}.${method}.${path}.${body}` using the shared service secret |
| `Content-Type` | `String` | `application/json` |

> [!CAUTION]
> **Zero Browser Exposure:** The `X-AVS-Service-Key` and service secret must **NEVER** be sent to client browsers or stored in frontend Javascript bundles. All calls to the ERP API must originate from the Public Website backend / PHP server.

---

## 3. Endpoints & API Surface

**Base URL:** `https://dqgrrafuoxaorvyrcuuh.supabase.co/functions/v1/subscription-v1`  
*(Or ERP Hostinger API Gateway: `https://erp.arivahly.in/api/v1/subscription`)*

---

### 3.1. Retrieve Public Active Plans
**Endpoint:** `GET /plans` or `POST { "action": "get_plans" }`  
**Description:** Returns the active commercial plans, official pricing in INR, limits, and feature access flags.

#### Request Example:
```http
GET /plans HTTP/1.1
Host: dqgrrafuoxaorvyrcuuh.supabase.co
X-AVS-Service-Key: avs_svc_pubsite_prod_v1
X-AVS-Timestamp: 1788602400000
```

#### Response Schema (`200 OK`):
```json
{
  "ok": true,
  "plans": [
    {
      "plan_id": "c1f7b820-9182-42da-912a-8c1e2b4f910a",
      "plan_code": "free_trial",
      "name": "AVS Free Trial",
      "description": "14-day full evaluation trial with standard operational modules",
      "currency": "INR",
      "monthly_price_paise": 0,
      "annual_price_paise": 0,
      "monthly_price_inr": 0,
      "annual_price_inr": 0,
      "custom_price_supported": false,
      "trial_days": 14,
      "grace_days": 7,
      "version": 1,
      "limits": {
        "max_users": 3,
        "max_branches": 1,
        "max_storage_gb": 5,
        "portal_access": true,
        "api_access": false,
        "reports_access": true,
        "integrations_access": false,
        "whatsapp_access": false,
        "payment_gateway_access": false,
        "backup_access": true
      }
    },
    {
      "plan_id": "d2e8c931-a293-53eb-a23b-9d2f3c5a021b",
      "plan_code": "avs_10k",
      "name": "AVS Workshop Starter",
      "description": "Entry workshop & retail ERP — stock, orders, workshop jobwork, gold ledger",
      "currency": "INR",
      "monthly_price_paise": 100000,
      "annual_price_paise": 1000000,
      "monthly_price_inr": 1000.00,
      "annual_price_inr": 10000.00,
      "custom_price_supported": false,
      "trial_days": 14,
      "grace_days": 7,
      "version": 1,
      "limits": {
        "max_users": 3,
        "max_branches": 1,
        "max_storage_gb": 10,
        "portal_access": false,
        "api_access": false,
        "reports_access": false,
        "integrations_access": false,
        "whatsapp_access": false,
        "payment_gateway_access": false,
        "backup_access": true
      }
    },
    {
      "plan_id": "e3f9da42-b3a4-64fc-b34c-0e3a4d6b132c",
      "plan_code": "avs_30k",
      "name": "AVS Manufacturing Standard",
      "description": "Full manufacturing & showroom — GST e-invoicing, barcode tagging, customer portal",
      "currency": "INR",
      "monthly_price_paise": 280000,
      "annual_price_paise": 3000000,
      "monthly_price_inr": 2800.00,
      "annual_price_inr": 30000.00,
      "custom_price_supported": false,
      "trial_days": 14,
      "grace_days": 7,
      "version": 1,
      "limits": {
        "max_users": 10,
        "max_branches": 2,
        "max_storage_gb": 25,
        "portal_access": true,
        "api_access": true,
        "reports_access": true,
        "integrations_access": false,
        "whatsapp_access": true,
        "payment_gateway_access": true,
        "backup_access": true
      }
    },
    {
      "plan_id": "f40aeb53-c4b5-75ad-c45d-1f4b5e7c243d",
      "plan_code": "avs_50k",
      "name": "AVS Enterprise Pro",
      "description": "Multi-branch, advanced analytics, karigar & supplier portals, automated cloud backups",
      "currency": "INR",
      "monthly_price_paise": 480000,
      "annual_price_paise": 5000000,
      "monthly_price_inr": 4800.00,
      "annual_price_inr": 50000.00,
      "custom_price_supported": false,
      "trial_days": 14,
      "grace_days": 7,
      "version": 1,
      "limits": {
        "max_users": 25,
        "max_branches": 5,
        "max_storage_gb": 100,
        "portal_access": true,
        "api_access": true,
        "reports_access": true,
        "integrations_access": true,
        "whatsapp_access": true,
        "payment_gateway_access": true,
        "backup_access": true
      }
    }
  ]
}
```

---

### 3.2. Get Tenant Subscription State
**Endpoint:** `GET /tenant/:tenant_id` or `POST { "action": "get_tenant_subscription", "tenantId": "..." }`  
**Description:** Returns the subscription status, active dates, plan details, and quota limits for a given tenant.

#### Request Example:
```http
POST /tenant-subscription HTTP/1.1
Host: dqgrrafuoxaorvyrcuuh.supabase.co
X-AVS-Service-Key: avs_svc_pubsite_prod_v1
X-AVS-Timestamp: 1788602400000
Content-Type: application/json

{
  "action": "get_tenant_subscription",
  "tenantId": "8b9e28f1-33da-4e89-9a28-98e3b72c91a0"
}
```

#### Response Schema (`200 OK`):
```json
{
  "ok": true,
  "tenant": {
    "tenant_id": "8b9e28f1-33da-4e89-9a28-98e3b72c91a0",
    "tenant_code": "maatarajewellers",
    "company_name": "Maa Tara Jewellers",
    "is_active": true
  },
  "subscription": {
    "subscription_id": "sub_9281a82e-9821-4f91-819a-1829a9b28192",
    "plan_id": "e3f9da42-b3a4-64fc-b34c-0e3a4d6b132c",
    "plan_code": "avs_30k",
    "plan_name": "AVS Manufacturing Standard",
    "plan_version": 1,
    "status": "active",
    "billing_interval": "annual",
    "amount_paise": 3000000,
    "currency": "INR",
    "starts_at": "2026-08-01T10:00:00Z",
    "renews_at": "2027-08-01T10:00:00Z",
    "trial_ends_at": null,
    "is_operational": true,
    "days_remaining": 330
  },
  "entitlements": {
    "max_branches": 2,
    "max_users": 10,
    "max_storage_gb": 25,
    "portal_access": true,
    "api_access": true,
    "reports_access": true,
    "integrations_access": false,
    "whatsapp_access": true,
    "payment_gateway_access": true,
    "backup_access": true
  }
}
```

---

### 3.3. Create Checkout Session
**Endpoint:** `POST /checkout/session` or `POST { "action": "create_checkout_session" }`  
**Description:** Authoritatively creates a platform commercial invoice, prepares a Razorpay Order ID, and returns the verified amount and checkout parameters.

#### Request Example:
```http
POST /checkout/session HTTP/1.1
Host: dqgrrafuoxaorvyrcuuh.supabase.co
X-AVS-Service-Key: avs_svc_pubsite_prod_v1
X-AVS-Timestamp: 1788602400000
Content-Type: application/json

{
  "action": "create_checkout_session",
  "tenantId": "8b9e28f1-33da-4e89-9a28-98e3b72c91a0",
  "planCode": "avs_30k",
  "billingCycle": "annual",
  "customerName": "Raju Das",
  "customerEmail": "raju@maatarajewellers.shop",
  "customerPhone": "+919876543210"
}
```

#### Response Schema (`200 OK`):
```json
{
  "ok": true,
  "tenantId": "8b9e28f1-33da-4e89-9a28-98e3b72c91a0",
  "planCode": "avs_30k",
  "planName": "AVS Manufacturing Standard",
  "planVersion": 1,
  "billingCycle": "annual",
  "amountPaise": 3000000,
  "amountInr": 30000.00,
  "currency": "INR",
  "invoiceId": "inv_8192a019-4a92-491a-8291-a892b9182a01",
  "invoiceNo": "AVS-260905-1A92B1",
  "orderId": "order_RZP9102948102",
  "keyId": "rzp_live_k192837461928"
}
```

---

### 3.4. Submit Verified Payment Result
**Endpoint:** `POST /payment/verify` or `POST { "action": "verify_payment" }`  
**Description:** Receives the Razorpay payment details, validates signature, marks the invoice as paid, applies subscription renewal/conversion, provisions entitlements, and generates the official receipt.

#### Request Example:
```http
POST /payment/verify HTTP/1.1
Host: dqgrrafuoxaorvyrcuuh.supabase.co
X-AVS-Service-Key: avs_svc_pubsite_prod_v1
X-AVS-Timestamp: 1788602400000
Content-Type: application/json

{
  "action": "verify_payment",
  "tenantId": "8b9e28f1-33da-4e89-9a28-98e3b72c91a0",
  "invoiceId": "inv_8192a019-4a92-491a-8291-a892b9182a01",
  "razorpayPaymentId": "pay_RZP9876543210",
  "razorpayOrderId": "order_RZP9102948102",
  "razorpaySignature": "9f823a1b0283c482910fa8372619482710394827103948271928374619283746",
  "amountPaise": 3000000
}
```

#### Response Schema (`200 OK`):
```json
{
  "ok": true,
  "payment_id": "pay_71928301-3819-4819-a918-192837461920",
  "invoice_id": "inv_8192a019-4a92-491a-8291-a892b9182a01",
  "receipt_no": "RCP-260905-8B29A0",
  "subscription_id": "sub_9281a82e-9821-4f91-819a-1829a9b28192",
  "plan_code": "avs_30k",
  "status": "active",
  "renews_at": "2027-09-05T18:00:00Z"
}
```

---

### 3.5. Get Payment / Invoice Status
**Endpoint:** `GET /payment/:payment_id` or `POST { "action": "get_payment_status" }`  
**Description:** Fetches invoice status and official receipt details.

#### Request Example:
```http
POST /payment-status HTTP/1.1
Host: dqgrrafuoxaorvyrcuuh.supabase.co
X-AVS-Service-Key: avs_svc_pubsite_prod_v1
X-AVS-Timestamp: 1788602400000
Content-Type: application/json

{
  "action": "get_payment_status",
  "invoiceId": "inv_8192a019-4a92-491a-8291-a892b9182a01"
}
```

#### Response Schema (`200 OK`):
```json
{
  "ok": true,
  "invoice": {
    "invoiceId": "inv_8192a019-4a92-491a-8291-a892b9182a01",
    "invoiceNo": "AVS-260905-1A92B1",
    "tenantId": "8b9e28f1-33da-4e89-9a28-98e3b72c91a0",
    "totalPaise": 3000000,
    "paidPaise": 3000000,
    "status": "paid"
  },
  "receipt": {
    "receiptNo": "RCP-260905-8B29A0",
    "amountPaise": 3000000,
    "paymentMethod": "razorpay",
    "issuedAt": "2026-09-05T18:00:00Z"
  }
}
```

---

## 4. Error Codes & Handling

All error responses return a standardized JSON structure:

```json
{
  "ok": false,
  "error": "Human readable error description",
  "code": "MACHINE_READABLE_ERROR_CODE"
}
```

| HTTP Status | Error Code | Meaning |
| :--- | :--- | :--- |
| `401 Unauthorized` | `AUTH_KEY_REQUIRED` | Missing `X-AVS-Service-Key` header |
| `401 Unauthorized` | `AUTH_TIMESTAMP_EXPIRED` | Request timestamp drift exceeded 300s window |
| `403 Forbidden` | `AUTH_INVALID_KEY` | Invalid or revoked service key |
| `403 Forbidden` | `AUTH_KEY_EXPIRED` | Service key has passed its expiration date |
| `400 Bad Request` | `TENANT_REQUIRED` | Missing `tenantId` or `tenantCode` in request |
| `400 Bad Request` | `INVALID_SIGNATURE` | Razorpay signature verification failed |
| `400 Bad Request` | `INVALID_ACTION` | Unknown action requested |
| `404 Not Found` | `INVOICE_NOT_FOUND` | Invoice ID not found for specified tenant |
| `500 Server Error` | `SERVER_ERROR` | Internal error in ERP database or payment engine |

---

## 5. Security & Boundary Guarantees

1. **Tenant Isolation:** The Public Website backend can only query and mutate data for the explicit `tenant_id` authorized during checkout.
2. **Zero Schema Leaks:** ERP internal tables (gold inventory, customer ledgers, karigar jobwork, supplier purchase bills, employee salaries) are strictly isolated and never exposed through this S2S interface.
3. **No Dynamic Pricing:** The client/browser cannot alter plan pricing. The ERP recalculates and enforces the exact INR price for the chosen plan code and billing cycle on the server.
4. **Idempotent Webhooks & Payments:** Submitting the same `razorpayPaymentId` multiple times will return the existing receipt and payment record without duplicate billing or entitlement corruption.
