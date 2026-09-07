# Windsurf Cascade MCP Setup Guide

Connect **Codeium Windsurf** Cascade Agent to the **AVS Jewellery ERP MCP Server**.

---

## 1. Windsurf Global Configuration (`~/.codeium/windsurf/mcp_config.json`)

```json
{
  "mcpServers": {
    "avs-erp": {
      "serverUrl": "https://erp.arivahly.in/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_AVS_BEARER_TOKEN>",
        "X-Tenant-Id": "MTJ_FIRM"
      }
    }
  }
}
```

---

## 2. Cascade Agent Usage

In Cascade:
> *"Cascade, check the current stock of 22K bangles in AVS ERP and list items with fine gold weights."*
