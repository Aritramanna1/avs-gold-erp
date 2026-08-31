import { create } from "zustand";
import { runErpAudit } from "./run-audit";
import type { DefectFixStatus, DefectRetestStatus, ErpAuditReport } from "./types";

interface ErpAuditState {
  lastReport: ErpAuditReport | null;
  running: boolean;
  error: string | null;
  run: () => Promise<ErpAuditReport>;
  updateDefect: (
    defectId: string,
    patch: { fixStatus?: DefectFixStatus; retestStatus?: DefectRetestStatus },
  ) => void;
}

export const useErpAuditStore = create<ErpAuditState>()((set, get) => ({
  lastReport: null,
  running: false,
  error: null,
  run: async () => {
    set({ running: true, error: null });
    try {
      const report = await runErpAudit();
      set({ lastReport: report, running: false });
      try {
        sessionStorage.setItem("ornexa_erp_audit_last", JSON.stringify(report));
      } catch {
        /* private mode */
      }
      return report;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ running: false, error: message });
      throw err;
    }
  },
  updateDefect: (defectId, patch) => {
    const report = get().lastReport;
    if (!report) return;
    const defects = report.defects.map((d) =>
      d.id === defectId ? { ...d, ...patch } : d,
    );
    const next = { ...report, defects };
    set({ lastReport: next });
  },
}));

export function hydrateErpAuditFromSession(): ErpAuditReport | null {
  try {
    const raw = sessionStorage.getItem("ornexa_erp_audit_last");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ErpAuditReport;
    useErpAuditStore.setState({ lastReport: parsed });
    return parsed;
  } catch {
    return null;
  }
}
