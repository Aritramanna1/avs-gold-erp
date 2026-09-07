/**
 * AVS ERP — Model Context Protocol (MCP) Server
 *
 * Implements the standard JSON-RPC 2.0 server interface for the Model Context Protocol.
 * Serves tools, resources, and system diagnostics with strict role-based access control,
 * tenant/branch boundary isolation, workflow rule enforcement, and sanitized audit logging.
 */

import { executeMCPTool, ExecuteMCPToolParams } from "./mcp-executor";
import { listMCPTools, getMCPTool } from "./mcp-tool-registry";
import { createMCPAuthContext, CreateAuthContextParams } from "./mcp-auth-context";
import { MCPAuthContext, MCPToolDefinition, MCPToolResult } from "./mcp-types";
import { DEFAULT_FINENESS_BASIS } from "@/lib/gold";

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools: { listChanged: boolean };
    resources: { subscribe: boolean; listChanged: boolean };
    prompts: { listChanged: boolean };
    logging: Record<string, never>;
  };
  serverStatus: "RUNNING" | "DEGRADED" | "MAINTENANCE";
  finenessStandard: number;
}

/**
 * Authoritative MCP Server Instance
 */
export class MCPServer {
  private serverInfo: MCPServerInfo = {
    name: "avs-erp-mcp-server",
    version: "1.1.2",
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: false },
      logging: {},
    },
    serverStatus: "RUNNING",
    finenessStandard: DEFAULT_FINENESS_BASIS, // 995
  };

  /**
   * Returns server information and protocol capabilities.
   */
  public getServerInfo(): MCPServerInfo {
    return { ...this.serverInfo };
  }

  /**
   * Safe Server Health & Readiness check (never exposes secrets)
   */
  public getHealth(tenantId?: string) {
    const allTools = listMCPTools();
    const enabledTools = allTools.filter((t) => t.enabled);

    return {
      status: "HEALTHY",
      server: "DEPLOYED",
      protocolVersion: this.serverInfo.protocolVersion,
      finenessStandard: this.serverInfo.finenessStandard,
      tenantId: tenantId || "system",
      totalRegisteredTools: allTools.length,
      enabledToolsCount: enabledTools.length,
      namespaces: Array.from(new Set(allTools.map((t) => t.namespace))),
      uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 3600),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handles incoming JSON-RPC 2.0 requests from MCP clients (AI Agents, IDEs, Supervisor tools).
   */
  public async handleRequest(
    request: JSONRPCRequest,
    context?: Partial<MCPAuthContext>
  ): Promise<JSONRPCResponse> {
    const id = request.id !== undefined ? request.id : null;

    if (request.jsonrpc !== "2.0") {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" },
      };
    }

    try {
      switch (request.method) {
        case "initialize":
        case "mcp.initialize":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: this.serverInfo.protocolVersion,
              serverInfo: {
                name: this.serverInfo.name,
                version: this.serverInfo.version,
              },
              capabilities: this.serverInfo.capabilities,
              instructions:
                "AVS ERP authoritative MCP server for fine jewellery retail, manufacturing, gold books, and dual-entry accounting.",
            },
          };

        case "ping":
          return {
            jsonrpc: "2.0",
            id,
            result: { status: "pong", timestamp: new Date().toISOString() },
          };

        case "server/health":
        case "health":
          return {
            jsonrpc: "2.0",
            id,
            result: this.getHealth(context?.tenantId),
          };

        case "tools/list": {
          const role = context?.role || "owner";
          const tools = listMCPTools({ role });
          return {
            jsonrpc: "2.0",
            id,
            result: {
              tools: tools.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
                outputSchema: t.outputSchema,
                namespace: t.namespace,
                readWriteLevel: t.readWriteLevel,
                approvalRequired: t.approvalRequired,
              })),
            },
          };
        }

        case "tools/call": {
          const toolName = request.params?.name as string;
          const toolArguments = (request.params?.arguments as Record<string, unknown>) || {};

          if (!toolName) {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: "Missing required param: 'name'" },
            };
          }

          // Build and validate Auth Context
          const contextParams: CreateAuthContextParams = {
            userId: context?.userId || "usr_mcp_supervisor",
            userName: context?.userName || "Supervisor Operator",
            role: context?.role || "supervisor",
            tenantId: context?.tenantId || "avs_default_tenant",
            branchId: context?.branchId ?? "main-branch",
            allowedBranchIds: context?.allowedBranchIds || ["main-branch"],
            sessionId: context?.sessionId || `mcp_sess_${Date.now()}`,
            authMethod: context?.authMethod || "sms_otp",
            otpTransport: (context as any)?.otpTransport,
            idempotencyKey: (request.params?.idempotencyKey as string) || context?.idempotencyKey,
            approvalTicketId: (request.params?.approvalTicketId as string) || context?.approvalTicketId,
          };

          const authRes = createMCPAuthContext(contextParams);
          if (!authRes.context) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32000,
                message: authRes.error?.message || "Authentication validation failed",
                data: {
                  errorCode: authRes.error?.code,
                  details: authRes.error,
                },
              },
            };
          }

          const authContext = authRes.context;

          const executionResult: MCPToolResult = await executeMCPTool({
            toolName,
            parameters: toolArguments,
            context: authContext,
          });

          if (!executionResult.success) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: executionResult.approvalRequired ? -32001 : -32000,
                message: executionResult.error?.message || "MCP Tool execution failed",
                data: {
                  errorCode: executionResult.error?.code,
                  approvalRequired: executionResult.approvalRequired,
                  approvalTicketId: executionResult.approvalTicketId,
                  details: executionResult.error,
                },
              },
            };
          }

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof executionResult.data === "string" 
                    ? executionResult.data 
                    : JSON.stringify(executionResult.data, null, 2),
                },
              ],
              structuredData: executionResult.data,
              auditId: executionResult.auditId,
              executionDurationMs: executionResult.executionDurationMs,
            },
          };
        }

        case "resources/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              resources: [
                {
                  uri: "avs://ledger/chart-of-accounts",
                  name: "Master Chart of Accounts",
                  description: "Canonical dual-ledger Chart of Accounts with gold and monetary dimensions",
                  mimeType: "application/json",
                },
                {
                  uri: "avs://gold/fineness-standard",
                  name: "Shop Fineness Baseline",
                  description: "Official AVS fineness standard (995 / 99.50%)",
                  mimeType: "application/json",
                },
                {
                  uri: "avs://workflow/effective-config",
                  name: "Effective Workflow Configuration",
                  description: "Active workflow configuration with process rules and step mappings",
                  mimeType: "application/json",
                },
              ],
            },
          };

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method '${request.method}' not found.` },
          };
      }
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: err?.message || "Internal server error." },
      };
    }
  }
}

/**
 * Exported singleton server instance
 */
export const mcpServer = new MCPServer();
