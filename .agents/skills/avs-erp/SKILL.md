---
name: avs-erp
description: >-
  Connect to and interact with the live AVS Jewellery ERP system via Model Context Protocol (MCP).
  Use to inspect real-time system health, customer accounts, dual-dimension bullion ledgers (Cash ₹ + Fine Gold @ 995 basis),
  inventory stock, and prepare artisan/karigar settlements.
---

# AVS Jewellery ERP Assistant Skill

This skill provides direct access to the live **AVS Jewellery ERP** system via its Model Context Protocol (MCP) interface.

## Live Endpoints & Transport
* **Remote MCP URL**: `https://erp.arivahly.in/api/mcp`
* **Transport**: Streamable HTTP / JSON-RPC 2.0
* **Local Stdio Fallback**: `node scripts/mcp/avs-mcp-server.mjs`

## Core Accounting & Security Invariants
1. **Bullion Standard**: All pure gold calculations use the standard **995 / 99.50% fineness** basis.
2. **Dual-Dimension Ledger**: Discrete Cash (₹ paise) and Fine Gold (mg/g) balances are strictly maintained and NEVER collapsed into a single number.
3. **Multi-Tenant Isolation**: All operations are strictly scoped to the caller's tenant and branch (`MAIN`).
4. **Approval Gate**: Settlement write operations are in `PREPARE` mode and require multi-factor supervisor authorization.

## Discovered Tools
* `server/health`: Check ERP API status and fineness basis.
* `core.get_system_status`: Active tenant system status.
* `core.get_current_user`: Caller profile and role.
* `core.get_current_tenant`: Firm metadata, branch directory, rate card rules.
* `finance.get_account_balance`: Query dual-dimension ledger (Cash ₹ and 995 Gold).
* `stock.search_stock`: Search ready jewellery stock by barcode/category/purity.
* `customers.search_customers`: Customer KYC and outstanding balance inquiry.
* `karigar.prepare_karigar_settlement`: Calculate labour & wastage draft (PREPARE only).
