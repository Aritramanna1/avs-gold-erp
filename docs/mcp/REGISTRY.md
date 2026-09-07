# Official MCP Registry & Marketplace Distribution

Documentation for registering and publishing **AVS Jewellery ERP MCP Server** across official registries.

---

## 1. Official Model Context Protocol Registry
* **Registry Identifier**: `io.arivahly.erp.mcp`
* **Schema**: [`mcp/manifests/server.json`](file:///c:/final%20erp%2029.08/new%20and%20final/mcp/manifests/server.json)
* **Status**: Production Ready (Protocol 2024-11-05)

### Registration Command:
```bash
npx @modelcontextprotocol/registry-cli publish --manifest mcp/manifests/server.json
```

---

## 2. Glama Marketplace
* **Manifest**: [`mcp/manifests/glama.json`](file:///c:/final%20erp%2029.08/new%20and%20final/mcp/manifests/glama.json)
* **Listing**: Hosted HTTP server at `https://erp.arivahly.in/api/mcp`
* **Category**: ERP / Jewellery / Bullion / Accounting

---

## 3. Smithery Ecosystem
* **Manifest**: [`mcp/manifests/smithery.yaml`](file:///c:/final%20erp%2029.08/new%20and%20final/mcp/manifests/smithery.yaml)
* **Installation**:
  ```bash
  npx -y @smithery/cli install avs-jewellery-erp --client claude
  ```
