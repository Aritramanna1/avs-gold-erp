import type { BranchSettings } from "@/lib/settings-store";
import { enqueueOutbox, getDb, runLocal } from "@/lib/local-db";
import { getDeploymentMode } from "@/lib/deployment-mode";
import { saveDirect } from "@/lib/supabase-write";

function localRow(value: BranchSettings): Record<string, unknown> {
  return {
    branch_id: value.branchId,
    address: value.address ?? null,
    phone: value.phone ?? null,
    email: value.email ?? null,
    gstin: value.gstin ?? null,
    invoice_series: value.invoiceSeries ?? null,
    receipt_series: value.receiptSeries ?? null,
    barcode_series: value.barcodeSeries ?? null,
    smtp_host: value.smtpHost ?? null,
    smtp_port: value.smtpPort ?? null,
    smtp_user: value.smtpUser ?? null,
    smtp_password: value.smtpPassword ?? null,
    smtp_from_name: value.smtpFromName ?? null,
    smtp_from_email: value.smtpFromEmail ?? null,
    wa_phone_number: value.waPhoneNumber ?? null,
    thermal_printer_ip: value.thermalPrinterIp ?? null,
    thermal_printer_port: value.thermalPrinterPort ?? null,
    default_karat: value.defaultKarat ?? null,
    gold_rate_source: value.goldRateSource ?? null,
    invoice_template_id: value.invoiceTemplateId ?? null,
    receipt_template_id: value.receiptTemplateId ?? null,
    logo_url: value.logoUrl ?? null,
    logo_storage_path: value.logoStoragePath ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function saveBranchSettings(value: BranchSettings): Promise<void> {
  const mode = (await getDeploymentMode()) ?? "offline";
  if (mode === "online") {
    await saveDirect("branch_settings", value.branchId, value);
    return;
  }

  const row = localRow(value);
  await runLocal(() => {
    const columns = Object.keys(row);
    getDb().run(
      `INSERT INTO branch_settings (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
       ON CONFLICT(branch_id) DO UPDATE SET ${columns
         .filter((column) => column !== "branch_id")
         .map((column) => `${column} = excluded.${column}`)
         .join(", ")};`,
      columns.map((column) => row[column] as any),
    );
    enqueueOutbox(
      `branch_settings:${value.branchId}:${Date.now()}`,
      "branch_settings",
      value.branchId,
      "insert",
      value,
      null,
    );
  });
}
