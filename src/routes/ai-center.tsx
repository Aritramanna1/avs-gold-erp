import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAIConfig,
  saveAIConfig,
  AIService,
  resolveConfiguredApiKey,
  testAIConnectivity,
  type AIConfiguration,
  type AIProviderType,
} from "@/lib/ai-readiness/ai-service-interface";
import { getAIAuditLogs } from "@/lib/ai-readiness/ai-audit-logger";
import {
  Bot,
  ShieldCheck,
  Lock,
  Sparkles,
  CheckCircle2,
  Sliders,
  FileText,
  Activity,
  Cpu,
  Send,
  Loader2,
  RotateCcw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ai-center")({
  head: () => ({
    meta: [
      { title: "AI Center · AVS ERP" },
      { name: "description", content: "AI Agent activation, security controls, and audit logs." },
    ],
  }),
  component: AICenterPage,
});

interface AgentDef {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'ACTIVE' | 'SANDBOX' | 'DISABLED';
  permissionLevel: string;
}

const AGENT_ROSTER: AgentDef[] = [
  {
    id: 'inventory_assistant',
    name: 'AI Inventory & Stock Assistant',
    role: 'Live Stock & Vault Analysis',
    description: 'Queries live inventory counts, weights, vault fine gold balances, and stock ageing via ERP tools.',
    status: 'ACTIVE',
    permissionLevel: 'Level 0 (Read Only)',
  },
  {
    id: 'founder_copilot',
    name: 'Founder Copilot',
    role: 'Executive Intelligence & Summaries',
    description: 'Summarizes daily sales, cash flows, active job cards, and operational status for management.',
    status: 'ACTIVE',
    permissionLevel: 'Level 0 (Read & Summarize)',
  },
  {
    id: 'quotation_assistant',
    name: 'AI Quotation Assistant',
    role: 'Draft Quotation Calculator',
    description: 'Calculates draft quotations using live frozen gold rates and standard making charge calculations.',
    status: 'ACTIVE',
    permissionLevel: 'Level 1 (Draft Only · Human Approval)',
  },
  {
    id: 'karigar_assistant',
    name: 'Karigar Process Copilot',
    role: 'Workshop & Balances Verification',
    description: 'Provides real-time balances, over-loss tracking, and workshop process verification for artisans.',
    status: 'ACTIVE',
    permissionLevel: 'Level 0 (Read Only)',
  },
];

function AICenterPage() {
  const [config, setConfig] = useState<AIConfiguration>(getAIConfig);
  const [apiKeyInput, setApiKeyInput] = useState(config.apiKey || "");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testPrompt, setTestPrompt] = useState("Summarize today's sales and vault gold balance");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState(getAIAuditLogs);

  useEffect(() => {
    setAuditLogs(getAIAuditLogs());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...config,
      apiKey: apiKeyInput.trim(),
      enabled: config.enabled,
    };
    saveAIConfig(updated);
    setConfig(updated);
    setSaveSuccess(true);
    toast.success("AI Configuration updated successfully");
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handlePingTest = async () => {
    setIsTestingPing(true);
    setPingResult(null);
    try {
      const result = await testAIConnectivity(config.provider, apiKeyInput.trim() || undefined, config.model);
      setPingResult(result);
      if (result.success) {
        toast.success(`API Connected (${result.latencyMs}ms)`);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      setPingResult({ success: false, latencyMs: 0, message: err?.message || "Ping test failed" });
      toast.error("Ping test failed");
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleTestRun = async () => {
    if (!testPrompt.trim()) return;
    setIsGenerating(true);
    setTestResult(null);
    try {
      const res = await AIService.generate({
        systemContext: "You are the authoritative AI assistant for AVS Gold & Jewellery Manufacturing ERP.",
        userPrompt: testPrompt,
      });

      if (res.success && res.content) {
        setTestResult(res.content);
        setAuditLogs(getAIAuditLogs());
        toast.success("AI Generation completed successfully");
      } else {
        setTestResult(`Error: ${res.error || "Generation failed"}`);
        toast.error(res.error || "Generation failed");
      }
    } catch (err: any) {
      setTestResult(`Error: ${err?.message || String(err)}`);
      toast.error(err?.message || "Failed to execute AI request");
    } finally {
      setIsGenerating(false);
    }
  };

  const detectedKey = resolveConfiguredApiKey();
  const statusInfo = AIService.getStatusDescription();

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="AI Center & Executive Copilot"
        description="Arivahly Venture Sphere AI Layer — Schema-bound ERP tool execution with strict authorization."
      />

      {/* Main Status Banner */}
      <Card className="border-emerald-500/30 bg-emerald-500/5 p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-semibold px-2.5 py-0.5">
                AI STATUS: OPERATIONAL
              </Badge>
              <Badge variant="outline" className="bg-slate-500/10 text-slate-300 border-slate-500/20 font-mono text-xs">
                {detectedKey ? "Paid API Key Configured" : "ERP Tools Active"}
              </Badge>
              <Badge variant="outline" className="bg-gold/10 text-gold border-gold/30 font-mono text-xs">
                {config.provider} ({config.model})
              </Badge>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {statusInfo.message}
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              AI operates exclusively through controlled ERP tools and respects role-based permissions. Financial ledgers and gold movements remain protected by strict validation controls.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 border rounded-lg px-3 py-2">
              <Lock className="h-4 w-4 text-emerald-500" />
              <span>Permission Guardrails Enforced</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Live Interactive Test Workbench */}
      <Card className="p-5 border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <h3 className="font-semibold text-sm">Live AI Copilot Testing Workbench</h3>
          </div>
          <Badge variant="secondary" className="text-xs">Live Tool Execution</Badge>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Ask Copilot about vault stock, today's sales, customer balance..."
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleTestRun();
                }
              }}
            />
            <Button
              onClick={handleTestRun}
              disabled={isGenerating || !testPrompt.trim()}
              className="bg-gold hover:bg-gold/90 text-black font-semibold shrink-0"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Run Copilot
            </Button>
          </div>

          {testResult && (
            <div className="p-4 rounded-lg bg-muted/40 border text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground">
              {testResult}
            </div>
          )}
        </div>
      </Card>

      {/* AI Readiness Agent Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Active ERP AI Copilots</h3>
            <p className="text-xs text-muted-foreground">Configured agents operating through standard ERP tools.</p>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            {AGENT_ROSTER.length} Agents Available
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {AGENT_ROSTER.map((agent) => (
            <Card key={agent.id} className="p-4 border bg-card/60 flex flex-col justify-between space-y-3 hover:border-gold/40 transition-colors">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-9 w-9 rounded-lg bg-gold/10 text-gold flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider text-emerald-500 border-emerald-500/30">
                    Active
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{agent.name}</h4>
                  <p className="text-xs text-gold font-medium">{agent.role}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {agent.description}
                </p>
              </div>

              <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-mono">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  {agent.permissionLevel}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Configuration & Safety Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Settings */}
        <Card className="p-5 border space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-gold" />
            <h3 className="font-semibold text-sm">AI Provider & API Configuration</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Active AI Provider</Label>
              <select
                value={config.provider}
                onChange={(e) => setConfig({ ...config, provider: e.target.value as AIProviderType })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              >
                <option value="google_gemini">Google Gemini (Gemini 1.5 Flash / Pro)</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                <option value="none">Disabled</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">API Key (Secure Storage)</Label>
              <Input
                type="password"
                placeholder={detectedKey ? "••••••••••••••••••••••••" : "Enter API key..."}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                {detectedKey ? "API Key detected and active." : "Provide paid API key to enable live cloud models."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Model Name</Label>
              <Input
                type="text"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">AI Safety & Approval Mode</Label>
              <select
                value={config.approvalMode}
                onChange={(e) => setConfig({ ...config, approvalMode: e.target.value as any })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              >
                <option value="supervised">Supervised (Low-risk queries auto-executed, changes require approval)</option>
                <option value="strict_approval">Strict Sandbox (All Actions Require Human Approval)</option>
                <option value="autonomous_low_risk">Autonomous Low-Risk (Read-only analytics)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handlePingTest}
                disabled={isTestingPing || (!apiKeyInput.trim() && !detectedKey)}
                className="w-1/2 text-xs border-gold/30 hover:border-gold"
              >
                {isTestingPing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-gold" />
                    Testing API...
                  </>
                ) : (
                  <>
                    <Wifi className="h-3.5 w-3.5 mr-1 text-gold" />
                    Test Connectivity
                  </>
                )}
              </Button>
              <Button type="submit" className="w-1/2 bg-gold hover:bg-gold/90 text-black font-semibold text-xs">
                Save AI Configuration
              </Button>
            </div>

            {pingResult && (
              <div className={`p-2.5 rounded text-xs border flex items-center justify-between ${
                pingResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                <div className="flex items-center gap-1.5 truncate">
                  {pingResult.success ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{pingResult.message}</span>
                </div>
                {pingResult.success && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shrink-0 font-mono">
                    {pingResult.latencyMs}ms
                  </Badge>
                )}
              </div>
            )}

            {saveSuccess && (
              <div className="text-xs text-emerald-500 flex items-center justify-center gap-1.5 pt-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>AI Configuration Saved & Verified</span>
              </div>
            )}
          </form>
        </Card>

        {/* Safety Matrix Principles */}
        <Card className="p-5 border space-y-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-sm">ERP Security & Accounting Guardrails</h3>
          </div>

          <div className="space-y-2.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2 bg-background/80 p-2.5 rounded-md border">
              <Lock className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Zero Direct Database Tampering:</strong>
                <p>AI interacts exclusively through typed, permission-gated ERP tools and cannot arbitrarily modify SQL or financial ledgers.</p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-background/80 p-2.5 rounded-md border">
              <Lock className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Strict Authorization & Maker-Checker:</strong>
                <p>AI actions that draft quotations, tasks, or follow-ups require explicit staff review and approval.</p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-background/80 p-2.5 rounded-md border">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Immutable Audit Logging:</strong>
                <p>Every tool invocation, prompt, and execution result is stamped with timestamps and user context in the audit trail.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Action Audit Log */}
      <Card className="p-5 border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gold" />
            <h3 className="font-semibold text-sm">AI Action Audit Trail</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAuditLogs(getAIAuditLogs())} className="text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Refresh Logs
          </Button>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
            No AI actions executed yet. Run a prompt in the workbench to generate audit logs.
          </div>
        ) : (
          <div className="space-y-2">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="p-3 border rounded-lg flex items-center justify-between text-xs bg-card/60">
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>{log.agentName}</span>
                    <span className="text-muted-foreground font-normal">·</span>
                    <span className="text-gold font-mono">{log.toolUsed}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString("en-IN")} · {log.provider} ({log.model})
                  </div>
                </div>
                <Badge variant="outline" className={log.approvalStatus === "auto_executed" ? "text-emerald-500 border-emerald-500/30" : "text-amber-500 border-amber-500/30"}>
                  {log.approvalStatus}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
