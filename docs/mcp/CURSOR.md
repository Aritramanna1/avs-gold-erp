# Cursor IDE MCP Integration Guide

Configure **Cursor** to use the **AVS Jewellery ERP Remote MCP Server**.

---

## 1. Setup in Cursor Settings

1. Open **Cursor Settings** > **Features** > **MCP**.
2. Click **+ Add New MCP Server**.
3. Fill in:
   * **Name**: `avs-erp`
   * **Type**: `command` or `sse / http`
   * **URL**: `https://erp.arivahly.in/api/mcp`
   * **Headers**:
     * `Authorization`: `Bearer <YOUR_AVS_BEARER_TOKEN>`
     * `X-Tenant-Id`: `MTJ_FIRM`
     * `X-Branch-Id`: `MAIN`

Or add directly to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "avs-erp-remote": {
      "url": "https://erp.arivahly.in/api/mcp",
      "headers": {
        "Authorization": "Bearer ${AVS_BEARER_TOKEN}",
        "X-Tenant-Id": "${AVS_TENANT_ID:-MTJ_FIRM}",
        "X-Branch-Id": "${AVS_BRANCH_ID:-MAIN}"
      }
    }
  }
}
```

---

## 2. Usage in Cursor Composer / Chat

In Cursor chat (`Ctrl+L` / `Cmd+L`), prompt:
> *"@avs-erp check inventory for 22K bangles in MAIN branch and report fine gold weights."*
