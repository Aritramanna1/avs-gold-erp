# Claude & Claude Code MCP Setup Guide

Connect **Claude Desktop** and **Claude Code CLI** to the remote **AVS Jewellery ERP MCP Server**.

---

## 1. Remote HTTP Configuration (`claude_desktop_config.json`)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "avs-erp-remote": {
      "url": "https://erp.arivahly.in/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_AVS_BEARER_TOKEN>",
        "X-Tenant-Id": "MTJ_FIRM",
        "X-Branch-Id": "MAIN"
      }
    }
  }
}
```

---

## 2. Claude Code CLI Setup

Add via Claude Code CLI:

```bash
claude mcp add --transport http avs-erp https://erp.arivahly.in/api/mcp \
  --header "Authorization: Bearer <YOUR_AVS_BEARER_TOKEN>" \
  --header "X-Tenant-Id: MTJ_FIRM"
```

---

## 3. Tool Verification

In Claude chat:
1. Ask Claude: *"What tools are available from AVS ERP?"*
2. Verify Claude sees `server/health`, `finance.get_account_balance`, `stock.search_stock`, and `karigar.prepare_karigar_settlement`.
