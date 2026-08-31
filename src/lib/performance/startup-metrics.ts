/**
 * Development/staging startup performance markers.
 * No PII — timings only. Call recordStartupMetric() at key lifecycle points.
 */

export type StartupMetricName =
  | "cold_boot"
  | "session_restore"
  | "auth_check_done"
  | "critical_load_done"
  | "dashboard_critical"
  | "tenant_switch"
  | "route_transition";

interface MetricEntry {
  name: StartupMetricName;
  ms: number;
  detail?: string;
  at: number;
}

const origin = typeof performance !== "undefined" ? performance.timeOrigin : Date.now();

const marks = new Map<StartupMetricName, number>();
const log: MetricEntry[] = [];

export function markStartup(name: StartupMetricName): void {
  if (typeof performance === "undefined") return;
  marks.set(name, performance.now());
}

export function recordStartupMetric(
  name: StartupMetricName,
  detail?: string,
  startName?: StartupMetricName,
): void {
  if (typeof performance === "undefined") return;
  const end = performance.now();
  const start = startName ? marks.get(startName) : undefined;
  const ms = start != null ? Math.round(end - start) : Math.round(end);
  const entry: MetricEntry = { name, ms, detail, at: Date.now() };
  log.push(entry);
  if (import.meta.env.DEV) {
    console.info(`[perf] ${name}: ${ms}ms${detail ? ` (${detail})` : ""}`);
  }
}

export function getStartupMetrics(): MetricEntry[] {
  return [...log];
}

export function getStartupMetricsSummary(): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const e of log) summary[e.name] = e.ms;
  if (typeof performance !== "undefined" && performance.timing) {
    summary.dom_content_loaded = performance.timing.domContentLoadedEventEnd - origin;
    summary.load_event = performance.timing.loadEventEnd - origin;
  }
  return summary;
}

/** Call once at app bootstrap */
export function initStartupMetrics(): void {
  markStartup("cold_boot");
  if (typeof window !== "undefined") {
    window.addEventListener("load", () => {
      recordStartupMetric("cold_boot", "window.load");
    });
  }
}
