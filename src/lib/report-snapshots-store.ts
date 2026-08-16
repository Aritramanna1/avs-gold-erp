import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface ReportSnapshot {
  id: string;
  reportCode: string;
  reportName: string;
  filters: Record<string, unknown>;
  snapshotData: Record<string, unknown>;
  savedAt: string;
  status: "saved" | "verified" | "archived";
}

interface ReportSnapshotsState {
  snapshots: ReportSnapshot[];
  loading: boolean;
  hydrate: () => Promise<void>;
  saveSnapshot: (input: {
    reportCode: string;
    reportName: string;
    filters?: Record<string, unknown>;
    snapshotData?: Record<string, unknown>;
  }) => Promise<ReportSnapshot | null>;
  verifySnapshot: (snapshotId: string, verifierName: string, note?: string) => Promise<boolean>;
}

export const useReportSnapshots = create<ReportSnapshotsState>()((set, get) => ({
  snapshots: [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("report_snapshots" as never)
      .select("id,report_code,report_name,filters,snapshot_data,saved_at,status")
      .order("saved_at", { ascending: false })
      .limit(50);
    if (!error) {
      set({
        snapshots: ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          reportCode: String(row.report_code),
          reportName: String(row.report_name),
          filters: (row.filters as Record<string, unknown>) ?? {},
          snapshotData: (row.snapshot_data as Record<string, unknown>) ?? {},
          savedAt: String(row.saved_at),
          status: row.status as ReportSnapshot["status"],
        })),
      });
    }
    set({ loading: false });
  },

  saveSnapshot: async (input) => {
    const { data, error } = await supabase
      .from("report_snapshots" as never)
      .insert({
        report_code: input.reportCode,
        report_name: input.reportName,
        filters: input.filters ?? {},
        snapshot_data: input.snapshotData ?? {},
        status: "saved",
      } as never)
      .select("id,report_code,report_name,filters,snapshot_data,saved_at,status")
      .single();
    if (error) return null;
    const row = data as unknown as Record<string, unknown>;
    const snap: ReportSnapshot = {
      id: String(row.id),
      reportCode: String(row.report_code),
      reportName: String(row.report_name),
      filters: (row.filters as Record<string, unknown>) ?? {},
      snapshotData: (row.snapshot_data as Record<string, unknown>) ?? {},
      savedAt: String(row.saved_at),
      status: "saved",
    };
    set({ snapshots: [snap, ...get().snapshots] });
    return snap;
  },

  verifySnapshot: async (snapshotId, verifierName, note) => {
    const { data: session } = await supabase.auth.getSession();
    const { error } = await supabase.from("report_verifications" as never).insert({
      snapshot_id: snapshotId,
      verified_by: session.session?.user.id ?? null,
      verified_by_name: verifierName,
      verification_note: note ?? null,
    } as never);
    if (error) return false;
    await supabase
      .from("report_snapshots" as never)
      .update({ status: "verified" } as never)
      .eq("id", snapshotId);
    set({
      snapshots: get().snapshots.map((s) =>
        s.id === snapshotId ? { ...s, status: "verified" as const } : s,
      ),
    });
    return true;
  },
}));
