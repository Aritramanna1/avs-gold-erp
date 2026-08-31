/**
 * ERP Audit Report — types per 02_ERP_AUDIT_REPORT_SPEC.md
 * PASS / FAIL / BLOCKED with evidence, defects, fix/retest status.
 */

export type AuditStatus = "PASS" | "FAIL" | "BLOCKED";
export type DefectSeverity = "P0" | "P1" | "P2" | "P3";
export type DefectCategory =
  | "critical"
  | "data_integrity"
  | "security_rls"
  | "calculation"
  | "hardware"
  | "performance"
  | "reliability"
  | "ux";

export type DefectFixStatus = "OPEN" | "FIXED" | "WONTFIX";
export type DefectRetestStatus = "NOT_RUN" | "PASS" | "FAIL" | "NEEDS_RETEST";

export interface AuditEvidence {
  kind: "id" | "count" | "message" | "duration_ms" | "route" | "rpc";
  label: string;
  value: string | number | boolean | null;
}

export interface AuditDefect {
  id: string;
  moduleId: string;
  category: DefectCategory;
  severity: DefectSeverity;
  title: string;
  detail: string;
  reproductionSteps: string[];
  evidence: AuditEvidence[];
  fixStatus: DefectFixStatus;
  retestStatus: DefectRetestStatus;
}

export interface AuditModuleResult {
  id: string;
  label: string;
  group: string;
  status: AuditStatus;
  score: number; // 0–100 for this module
  summary: string;
  evidence: AuditEvidence[];
  defectIds: string[];
  durationMs: number;
}

export interface ErpAuditReport {
  id: string;
  createdAt: number;
  firmId: string | null;
  overallScore: number;
  overallStatus: AuditStatus;
  readyForRelease: boolean;
  modules: AuditModuleResult[];
  defects: AuditDefect[];
  notes: string[];
}
