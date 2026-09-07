# VS Code & GitHub Copilot MCP Setup Guide

Configure **Visual Studio Code** and **GitHub Copilot Chat** to interact with **AVS Jewellery ERP**.

---

## 1. Configuration in `.vscode/mcp.json`

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "avs-erp": {
      "type": "http",
      "url": "https://erp.arivahly.in/api/mcp",
      "headers": {
        "Authorization": "Bearer ${env:AVS_BEARER_TOKEN}",
        "X-Tenant-Id": "${env:AVS_TENANT_ID:-MTJ_FIRM}"
      }
    }
  }
}
```

---

## 2. GitHub Copilot Usage

In VS Code Copilot Chat (`Ctrl+Alt+I` / `Cmd+I`):
> *"@mcp /avs-erp check customer Sanjay Mehta balance and open gold positions."*
