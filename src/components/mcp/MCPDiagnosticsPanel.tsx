/**
 * AVS ERP — MCP Foundation & AI Readiness Diagnostics Panel
 *
 * Provides transparent operational visibility into:
 * - AI capability activation status (ACTIVE)
 * - MCP foundation status (READY)
 * - MCP server deployment state (NOT YET DEPLOYED)
 * - Supervisor SMS OTP security model
 * - Role-scoped tool registry across 16 namespaces
 * - Recent sanitized audit logs
 */

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Server,
  ShieldCheck,
  Cpu,
  Layers,
  CheckCircle2,
  Lock,
  Clock,
  Search,
  Activity,
  AlertCircle,
  FileCode,
} from "lucide-react";
import { listMCPTools } from "@/lib/mcp/mcp-tool-registry";
import { getMCPAuditLogs } from "@/lib/mcp/mcp-audit";
import { MCPNamespace } from "@/lib/mcp/mcp-types";

export const MCPDiagnosticsPanel: React.FC = () => {
  const [selectedNamespace, setSelectedNamespace] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allTools = listMCPTools();
  const auditLogs = getMCPAuditLogs();

  const filteredTools = allTools.filter((t) => {
    const matchesNs = selectedNamespace === "all" || t.namespace === selectedNamespace;
    const matchesQ =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesNs && matchesQ;
  });

  const namespaces: MCPNamespace[] = [
    "core",
    "customers",
    "crm",
    "retail",
    "inventory",
    "manufacturing",
    "karigar",
    "payroll",
    "owner",
    "finance",
    "production",
    "barcode",
    "hallmark",
    "documents",
    "reports",
    "system",
  ];

  return (
    <div className="space-y-6">
      {/* ── 1. SYSTEM READINESS STATUS CARDS ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-emerald-500 bg-card/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">AI Capabilities</span>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
              <CheckCircle2 className="w-3 h-3" /> ACTIVE
            </Badge>
          </div>
          <div className="text-xl font-bold tracking-tight">Activated</div>
          <p className="text-xs text-muted-foreground mt-1">Controlled ERP service layer enabled</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 bg-card/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">MCP Foundation</span>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1">
              <Cpu className="w-3 h-3" /> READY
            </Badge>
          </div>
          <div className="text-xl font-bold tracking-tight">{allTools.length} Registered Tools</div>
          <p className="text-xs text-muted-foreground mt-1">Across 16 operational namespaces</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500 bg-card/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">MCP Server Deployment</span>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              NOT YET DEPLOYED
            </Badge>
          </div>
          <div className="text-xl font-bold tracking-tight">Foundation Ready</div>
          <p className="text-xs text-muted-foreground mt-1">Ready for standalone MCP server target</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 bg-card/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Supervisor MCP</span>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 gap-1">
              <ShieldCheck className="w-3 h-3" /> SMS OTP
            </Badge>
          </div>
          <div className="text-xl font-bold tracking-tight">Role-Secured</div>
          <p className="text-xs text-muted-foreground mt-1">Strict branch & tenant containment</p>
        </Card>
      </div>

      {/* ── 2. POLICY & GUARDRAIL STATUS ────────────────────────────────────── */}
      <Card className="p-5 bg-card/60">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> AI & MCP Enterprise Governance Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1 p-3 rounded-lg border bg-background/50">
            <span className="font-semibold text-foreground flex items-center justify-between">
              Autonomous Write Control
              <Badge variant="secondary" className="text-[10px]">Permission-Gated</Badge>
            </span>
            <p className="text-muted-foreground">AI operates strictly through validated ERP services; direct database SQL execution is blocked.</p>
          </div>

          <div className="space-y-1 p-3 rounded-lg border bg-background/50">
            <span className="font-semibold text-foreground flex items-center justify-between">
              High-Risk Operations
              <Badge variant="secondary" className="text-[10px]">Approval Required</Badge>
            </span>
            <p className="text-muted-foreground">Discounts, stock adjustments, and Karigar settlements require explicit manager sign-off tickets.</p>
          </div>

          <div className="space-y-1 p-3 rounded-lg border bg-background/50">
            <span className="font-semibold text-foreground flex items-center justify-between">
              AI Calling Interface
              <Badge variant="secondary" className="text-[10px]">Ready (Inactive)</Badge>
            </span>
            <p className="text-muted-foreground">Autonomous cold calling is disabled. Interface connects exclusively via controlled CRM tools.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. MCP TOOL REGISTRY BROWSER ─────────────────────────────────────── */}
      <Card className="p-5 bg-card/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> MCP Tool Registry ({filteredTools.length} Tools)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Authoritative tools exposed to MCP Supervisor and authorized ERP roles</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs w-44 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Namespace Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin">
          <Button
            size="sm"
            variant={selectedNamespace === "all" ? "default" : "outline"}
            onClick={() => setSelectedNamespace("all")}
            className="h-7 text-xs px-2.5"
          >
            All ({allTools.length})
          </Button>
          {namespaces.map((ns) => {
            const count = allTools.filter((t) => t.namespace === ns).length;
            return (
              <Button
                key={ns}
                size="sm"
                variant={selectedNamespace === ns ? "default" : "outline"}
                onClick={() => setSelectedNamespace(ns)}
                className="h-7 text-xs px-2.5 capitalize"
              >
                {ns} ({count})
              </Button>
            );
          })}
        </div>

        {/* Tools Table */}
        <div className="rounded-md border overflow-hidden">
          <div className="overflow-x-auto max-h-[380px] scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 sticky top-0 border-b">
                <tr>
                  <th className="p-2.5 font-medium">Tool Name</th>
                  <th className="p-2.5 font-medium">Namespace</th>
                  <th className="p-2.5 font-medium">Read/Write</th>
                  <th className="p-2.5 font-medium">Allowed Roles</th>
                  <th className="p-2.5 font-medium">Approval</th>
                  <th className="p-2.5 font-medium">Rate Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTools.map((tool) => (
                  <tr key={tool.name} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-mono font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                        <span>{tool.name}</span>
                        <span className="text-[10px] text-muted-foreground">{tool.version}</span>
                      </div>
                      <p className="font-sans text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tool.description}</p>
                    </td>
                    <td className="p-2.5 capitalize font-medium">{tool.namespace}</td>
                    <td className="p-2.5">
                      <Badge
                        variant="outline"
                        className={
                          tool.readWriteLevel === "READ"
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]"
                            : tool.readWriteLevel === "PREPARE"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]"
                            : "bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px]"
                        }
                      >
                        {tool.readWriteLevel}
                      </Badge>
                    </td>
                    <td className="p-2.5">
                      <span className="text-muted-foreground truncate max-w-[140px] block">
                        {tool.allowedRoles.slice(0, 3).join(", ")}
                        {tool.allowedRoles.length > 3 ? ` +${tool.allowedRoles.length - 3}` : ""}
                      </span>
                    </td>
                    <td className="p-2.5">
                      {tool.approvalRequired ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-[10px]">
                          Required
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Direct</span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                      {tool.rateLimit.maxPerMinute}/min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};
