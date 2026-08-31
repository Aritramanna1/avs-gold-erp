/**
 * Scheduled report deliveries store.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_AVS_PRODUCT } from "./communication-events";

export interface ScheduledReportDelivery {
  id: string;
  firmId: string;
  productId: string;
  reportKey: string;
  reportName: string;
  recipients: Array<{ name?: string; email?: string }>;
  scheduleCron: string;
  format: "html" | "pdf" | "excel" | "csv" | "link";
  channel: "email" | "whatsapp" | "in_app";
  branchId?: string;
  isActive: boolean;
  lastRunAt?: string;
}

function mapRow(row: Record<string, unknown>): ScheduledReportDelivery {
  return {
    id: String(row.id),
    firmId: String(row.firm_id),
    productId: String(row.product_id),
    reportKey: String(row.report_key),
    reportName: String(row.report_name),
    recipients: (row.recipients ?? []) as ScheduledReportDelivery["recipients"],
    scheduleCron: String(row.schedule_cron),
    format: String(row.format) as ScheduledReportDelivery["format"],
    channel: String(row.channel) as ScheduledReportDelivery["channel"],
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    isActive: Boolean(row.is_active),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
  };
}

export async function fetchScheduledReports(): Promise<ScheduledReportDelivery[]> {
  const { data, error } = await supabase
    .from("scheduled_report_deliveries" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function upsertScheduledReport(input: {
  id?: string;
  reportKey: string;
  reportName: string;
  scheduleCron: string;
  recipients: ScheduledReportDelivery["recipients"];
  format?: ScheduledReportDelivery["format"];
  channel?: ScheduledReportDelivery["channel"];
  branchId?: string;
  isActive?: boolean;
}): Promise<ScheduledReportDelivery | null> {
  const payload = {
    product_id: DEFAULT_AVS_PRODUCT,
    report_key: input.reportKey,
    report_name: input.reportName,
    schedule_cron: input.scheduleCron,
    recipients: input.recipients,
    format: input.format ?? "html",
    channel: input.channel ?? "email",
    branch_id: input.branchId ?? null,
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("scheduled_report_deliveries" as never)
      .update(payload as never)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("scheduled_report_deliveries" as never)
    .insert(payload as never)
    .select("*")
    .single();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteScheduledReport(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("scheduled_report_deliveries" as never)
    .delete()
    .eq("id", id);
  return !error;
}

export const REPORT_PRESETS = [
  { key: "report.daily.gold_position", name: "Daily Gold Position", cron: "daily@07:00" },
  { key: "report.daily.sales", name: "Daily Sales", cron: "daily@19:00" },
  { key: "report.daily.outstanding", name: "Outstanding Summary", cron: "daily@20:00" },
  { key: "report.weekly.ceo", name: "Weekly CEO Summary", cron: "weekly@monday@19:00" },
  { key: "report.monthly.accounts", name: "Monthly Accounts Summary", cron: "monthly@1@08:00" },
  { key: "report.monthly.stock", name: "Monthly Stock Report", cron: "monthly@1@09:00" },
];
