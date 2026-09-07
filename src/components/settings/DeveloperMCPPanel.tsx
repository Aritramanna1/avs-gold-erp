import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listMCPTools } from "@/lib/mcp/mcp-tool-registry";
import { MCPServer } from "@/lib/mcp/mcp-server";
import {
  Terminal,
  Cpu,
  Bot,
  Copy,
  Check,
  Play,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export function DeveloperMCPPanel() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>("stock_search_barcode");
  const [testPayload, setTestPayload] = useState<string>('{"query": "RING"}');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const mcpServer = new MCPServer();
  const serverInfo = mcpServer.getServerInfo();
  const health = mcpServer.getHealth();
  const tools = listMCPTools();

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Configuration copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunToolTest = async () => {
    setTesting(true);
    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(testPayload);
      } catch {
        toast.error("Invalid JSON in parameters field");
        setTesting(false);
        return;
      }

      const res = await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: `test-${Date.now()}`,
          method: "tools/call",
          params: {
            name: selectedTool,
            arguments: parsedParams,
          },
        },
        {
          userId: "admin-user",
          role: "owner",
          tenantId: "active-tenant",
          branchId: null,
          sessionId: "test-session",
          authMethod: "session_token",
          isSupervisor: true,
        }
      );
      setTestResponse(JSON.stringify(res, null, 2));
    } catch (err: any) {
      setTestResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setTesting(false);
    }
  };

  const claudeConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        "avs-gold-erp": {
          command: "node",
          args: ["./mcp-bridge/index.js"],
          env: {
            AVS_ERP_ENDPOINT: "https://erp.arivahly.in/api/mcp",
            AVS_API_KEY: "avs_live_xxxxxxxxxxxxxxxxxxxxxxxx",
            AVS_FINENESS_STANDARD: "995",
          },
        },
      },
    },
    null,
    2
  );

  const curlSnippet = `curl -X POST https://erp.arivahly.in/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer avs_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "req-1",
    "method": "tools/call",
    "params": {
      "name": "ledger_get_vault_balance",
      "arguments": { "metal": "GOLD_995" }
    }
  }'`;

  return (
    <div className="space-y-6">
      {/* Overview & Protocol Health Header */}
      <Card className="border-gold/30 bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 grid place-items-center text-gold">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>Model Context Protocol (MCP) Server</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                    {health.status}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect external AI Agents (Claude Desktop, ChatGPT, Open-Source LLMs) securely to your ERP operations.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                Protocol: {serverInfo.protocolVersion}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-gold border-gold/40">
                Fineness: {serverInfo.finenessStandard} Pure
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/60">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Registered Tools</div>
              <div className="text-lg font-bold text-foreground">{health.totalRegisteredTools} Tools</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Namespaces</div>
              <div className="text-lg font-bold text-foreground">{health.namespaces.length} Modules</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Auth Protocol</div>
              <div className="text-lg font-bold text-foreground">Bearer Token</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Format</div>
              <div className="text-lg font-bold text-foreground">JSON-RPC 2.0</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Guides & Interactive Sandbox */}
      <Tabs defaultValue="tools" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="tools" className="text-xs flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            <span>Tools Catalog</span>
          </TabsTrigger>
          <TabsTrigger value="connect" className="text-xs flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            <span>AI Connect</span>
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="text-xs flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            <span>Live Tester</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tools Catalog */}
        <TabsContent value="tools" className="space-y-3">
          <div className="grid gap-3">
            {tools.map((t) => (
              <div
                key={t.name}
                className="rounded-xl border border-border bg-card/80 p-4 hover:border-gold/40 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gold">{t.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {t.namespace}
                    </Badge>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    Roles: {(t.allowedRoles || []).join(", ") || "owner"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                <div className="pt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Parameters:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px]">
                    {Object.keys(t.inputSchema?.properties || {}).join(", ") || "none"}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: AI Client Connection */}
        <TabsContent value="connect" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span>Claude Desktop Integration</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Add this to your <code className="bg-muted px-1 rounded font-mono">claude_desktop_config.json</code>
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(claudeConfigSnippet, "claude")}
                  className="h-8 text-xs gap-1.5"
                >
                  {copiedId === "claude" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedId === "claude" ? "Copied" : "Copy Config"}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-3 rounded-lg bg-muted/60 font-mono text-xs text-foreground overflow-x-auto">
                {claudeConfigSnippet}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    <span>Direct API / cURL Execution</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Test direct JSON-RPC 2.0 tool execution over HTTPS
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(curlSnippet, "curl")}
                  className="h-8 text-xs gap-1.5"
                >
                  {copiedId === "curl" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedId === "curl" ? "Copied" : "Copy cURL"}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-3 rounded-lg bg-muted/60 font-mono text-xs text-foreground overflow-x-auto">
                {curlSnippet}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Interactive Sandbox Tester */}
        <TabsContent value="sandbox" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-gold" />
                <span>Interactive Tool Executor</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Select an MCP tool and simulate an AI execution request in real time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Select MCP Tool</label>
                  <select
                    value={selectedTool}
                    onChange={(e) => setSelectedTool(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-hidden focus:ring-2 focus:ring-gold"
                  >
                    {tools.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.namespace})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Payload Arguments (JSON)</label>
                  <input
                    type="text"
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-hidden focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>

              <Button
                onClick={handleRunToolTest}
                disabled={testing}
                className="bg-gold text-black hover:bg-gold/90 text-xs font-bold gap-1.5"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{testing ? "Executing Tool..." : "Execute MCP Tool"}</span>
              </Button>

              {testResponse && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-xs font-medium text-muted-foreground">JSON-RPC 2.0 Response:</div>
                  <pre className="p-3 rounded-lg bg-black/80 font-mono text-xs text-emerald-400 overflow-x-auto max-h-60 border border-border">
                    {testResponse}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
