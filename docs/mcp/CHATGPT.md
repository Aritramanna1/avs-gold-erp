# ChatGPT / OpenAI Apps SDK Integration Guide

Connect **ChatGPT** and the **OpenAI Apps SDK** directly to your **AVS Jewellery ERP** Model Context Protocol (MCP) server.

---

## 1. Overview
* **Server Name**: `AVS Jewellery ERP`
* **Remote MCP URL**: `https://erp.arivahly.in/api/mcp`
* **Transport**: `Streamable HTTP / JSON-RPC 2.0`
* **Protocol Version**: `2024-11-05`
* **Standard**: `995 / 99.50% Fine Gold`

---

## 2. Setup via OpenAI Custom Actions / Apps SDK

### Option A: ChatGPT Custom App (OAuth 2.1)
1. Navigate to **ChatGPT Settings** > **Connected Apps** / **Custom Actions**.
2. Select **Add Custom MCP App**.
3. Configure:
   * **Server URL**: `https://erp.arivahly.in/api/mcp`
   * **Authentication**: `OAuth 2.0 / 2.1`
   * **Authorization URL**: `https://erp.arivahly.in/login`
   * **Token URL**: `https://erp.arivahly.in/api/oauth/token`
   * **Scopes**: `erp:read`, `erp:prepare`
4. Complete the tenant login handshake to link your authorized ERP account.

### Option B: Direct Bearer Token Setup
Configure standard HTTP Authorization header in client settings:
```http
Authorization: Bearer <YOUR_AVS_BEARER_TOKEN>
X-Tenant-Id: <YOUR_TENANT_ID>
X-Branch-Id: MAIN
```

---

## 3. Example Prompts

* **Account Balances**:
  > *"Check the ledger balance for customer Sanjay Mehta. Show separate cash and 995 gold dimensions."*
* **Stock & Inventory**:
  > *"Search for all 22K necklaces currently in stock at Main Showroom."*
* **Karigar Preparation**:
  > *"Prepare a settlement summary for Karigar Gopal for completed job cards."*

---

## 4. Safety & Invariants
* **Read-Only vs Prepare**: Informational tools execute immediately; high-risk write operations enter `PREPARE` state and require Supervisor confirmation with SMS OTP.
* **Discrete Gold/Cash Separation**: Responses strictly separate Cash (₹ paise) and Fine Gold (mg/g @ 995 basis).
