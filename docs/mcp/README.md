# AVS Jewellery ERP — Model Context Protocol (MCP) Server

Official Model Context Protocol (MCP) server integration for **AVS Jewellery Ecosystem ERP**.

Provides standardized JSON-RPC 2.0 AI tool execution across all 16 ERP namespaces, strictly enforcing **Gold-First accounting** (discrete Fine Gold 995 basis vs Cash ₹ separation), **multi-tenant isolation**, **role-based access control**, **idempotency**, and **sanitized audit logging**.

---

## 1. What is AVS MCP?

AVS MCP is a secure bridge allowing AI assistants, autonomous agents, IDEs (such as Antigravity / Integravity, Claude Desktop, Cursor), and administrative automation scripts to interact with the AVS Jewellery ERP without bypassing business rules, ledger invariants, or tenant boundaries.

### Key Guarantees:
* **One ERP, One Business Logic**: MCP tool calls execute through the same validated domain stores and engines (`DualLedger`, `WorkerGoldBook`, `CalculationEngine`, `BillingStore`).
* **Gold-First Dimension Separation**: Gold balances (grams @ 995 basis) and Cash balances (₹ paise) are never collapsed into a single currency string.
* **Strict Tenant & Branch Isolation**: Cross-tenant requests are denied immediately (`TENANT_ACCESS_DENIED`).
* **Supervisor Security**: Sensitive overrides strictly require authenticated SMS OTP.
* **Sanitized Audit Trail**: Every tool call records caller identity, timestamp, tenant, branch, and status—zero bearer tokens or passwords are ever logged.

---

## 2. Supported Transports & Endpoints

| Environment | Transport | Endpoint / Command |
| :--- | :--- | :--- |
| **Local IDE / Stdio (Integravity / Claude)** | `stdio` | `node scripts/mcp/avs-mcp-server.mjs` |
| **Cloud / Deployed HTTP** | `Streamable HTTP / JSON-RPC 2.0` | `https://erp.arivahly.in/api/mcp` (or in-app gateway) |

* **Protocol Version**: `2024-11-05`
* **JSON-RPC Version**: `2.0`
* **Bullion Fineness Basis**: `995 / 99.50%`

---

## 3. Integravity / Antigravity Setup Guide

To install and connect the AVS ERP MCP server in your **Integravity / Antigravity** environment:

### Step 1: Open MCP Configuration
In your project or workspace configuration, locate your MCP settings file (e.g. `mcp_config.json` or Antigravity MCP settings).

### Step 2: Add AVS ERP MCP Server
Add the following configuration (replace `<YOUR_AVS_BEARER_TOKEN>` with your tenant-scoped session token):

```json
{
  "mcpServers": {
    "avs-erp": {
      "command": "node",
      "args": [
        "c:/final erp 29.08/new and final/scripts/mcp/avs-mcp-server.mjs"
      ],
      "env": {
        "AVS_TENANT_ID": "MTJ_FIRM",
        "AVS_BRANCH_ID": "MAIN",
        "AVS_USER_ID": "usr_operator_01",
        "AVS_USER_ROLE": "admin",
        "AVS_AUTH_TOKEN": "<YOUR_AVS_BEARER_TOKEN>"
      }
    }
  }
}
```

### Step 3: Verify Connection
Run standard protocol validation:
1. `initialize` → Handshake succeeds with protocol `2024-11-05`
2. `ping` → Returns `pong`
3. `tools/list` → Discovers registered tools
4. `server/health` → Confirms database and service health

---

## 4. MCP Inspector Setup Guide

You can test and inspect tool definitions interactively using the official `@modelcontextprotocol/inspector`:

```bash
npx @modelcontextprotocol/inspector node scripts/mcp/avs-mcp-server.mjs
```

---

## 5. Authoritative Tool Registry

| Tool Name | Read/Write | Allowed Roles | Description |
| :--- | :---: | :--- | :--- |
| `server/health` | `READ` | All | Returns live system health, latency, active tenant, and 995 standard. |
| `core.get_system_status` | `READ` | All | Overall ERP status, shop fineness standard, and server time. |
| `core.get_current_user` | `READ` | All | Authenticated user profile, role, and branch permissions. |
| `core.get_current_tenant` | `READ` | All | Active firm details, branches, and rate card rules. |
| `finance.get_account_balance` | `READ` | Admin, Accountant | Discrete Cash (₹) and Fine Gold (grams @ 995) balance for any party. |
| `stock.search_stock` | `READ` | Admin, Sales, Karigar | Search inventory items, tag barcodes, gross/net weights, and purity. |
| `karigar.prepare_karigar_settlement`| `PREPARE` | Admin, Supervisor | Computes Karigar labour, allowed loss, and wastage (requires Supervisor OTP to post). |
| `customers.search_customers` | `READ` | Admin, Sales | Search customer directory with KYC status and ledger summaries. |

---

## 6. Gold-First Accounting Model

In AVS ERP, metal is never treated merely as a monetary equivalent. The MCP server strictly outputs dual discrete dimensions:

```json
{
  "cash": {
    "balanceRupees": "₹45,250.00",
    "balancePaise": 4525000,
    "currency": "INR"
  },
  "gold": {
    "quantityGrams": "128.450 g",
    "quantityMg": 128450,
    "purity": 995,
    "fineGoldGrams": "127.808 g",
    "basisStandard": 995
  },
  "isSeparated": true,
  "collapsedForbidden": true
}
```

---

## 7. Security & Tenant Isolation

1. **Authorization**: Every request context validates tenant scope and role permissions.
2. **Cross-Tenant Guard**: Calling a resource outside caller tenant returns:
   ```json
   {
     "error": {
       "code": 403,
       "message": "TENANT_ACCESS_DENIED: Cross-tenant access is strictly prohibited."
     }
   }
   ```
3. **Supervisor Gate**: Critical operations (e.g. melting approvals, rate card adjustments, large Karigar settlements) require SMS OTP.
4. **Zero Secret Leakage**: No private keys, JWTs, service-role keys, or webhook secrets are returned in tool responses or written to audit logs.

---

## 8. Verification & Test Suite

Run the automated test suite locally:

```bash
# Run comprehensive MCP integration and protocol suite
node qa/mcp/mcp-comprehensive-audit.mjs

# Run client secret scan
node scripts/security-scan.mjs
```
