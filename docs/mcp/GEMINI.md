# Gemini CLI & Extension MCP Integration Guide

Integrate the **AVS Jewellery ERP MCP Server** with **Gemini Code Assist** and the **Gemini CLI**.

---

## 1. Extension Configuration

Add the extension manifest or configure in `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "avs-jewellery-erp": {
      "url": "https://erp.arivahly.in/api/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${AVS_BEARER_TOKEN}",
        "X-Tenant-Id": "MTJ_FIRM"
      }
    }
  }
}
```

---

## 2. Testing via Gemini CLI

```bash
export AVS_BEARER_TOKEN="<YOUR_TOKEN>"
gemini mcp query --server avs-jewellery-erp --tool server/health
gemini mcp query --server avs-jewellery-erp --tool finance.get_account_balance --args '{"partyId":"cust_demo_01"}'
```
