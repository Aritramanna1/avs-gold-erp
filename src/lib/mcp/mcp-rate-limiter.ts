/**
 * AVS ERP — MCP Rate Limiting Engine
 *
 * Enforces sliding window rate limits across MCP tools, tenants, and roles to prevent runaway loops.
 */

import { MCPRateLimitConfig, MCPErrorDetails } from "./mcp-types";

interface RateLimitBucket {
  timestamps: number[];
}

class MCPRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  /**
   * Evaluates if an MCP request is within permitted rate limits.
   */
  public checkLimit(
    userId: string,
    toolName: string,
    config: MCPRateLimitConfig
  ): { allowed: boolean; error?: MCPErrorDetails } {
    const key = `${userId}:${toolName}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Filter out timestamps older than 1 minute
    bucket.timestamps = bucket.timestamps.filter((t) => t > oneMinuteAgo);

    if (bucket.timestamps.length >= config.maxPerMinute) {
      const oldestInWindow = bucket.timestamps[0] || now;
      const retryAfterSeconds = Math.ceil((oldestInWindow + 60_000 - now) / 1000);

      return {
        allowed: false,
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded for tool "${toolName}". Limit is ${config.maxPerMinute} requests per minute.`,
          retryAfterSeconds: Math.max(1, retryAfterSeconds),
        },
      };
    }

    // Record current execution
    bucket.timestamps.push(now);
    return { allowed: true };
  }

  public reset(): void {
    this.buckets.clear();
  }
}

export const mcpRateLimiter = new MCPRateLimiter();
