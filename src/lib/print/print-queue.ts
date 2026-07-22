import { getCloudDataClient } from "@/lib/providers/data-provider";

export interface PrintJobResult {
  jobId: string;
  status: "printed" | "pdf_fallback" | "failed";
  error?: string;
  pdfFileName?: string;
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `pj_${crypto.randomUUID()}`;
  return `pj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
}

export async function recordJob(
  id: string,
  docType: string,
  title: string,
  status: PrintJobResult["status"],
  attempts: number,
  error: string | undefined,
  pdfFileName: string | undefined,
): Promise<void> {
  const { error: insertError } = await getCloudDataClient().from("print_jobs" as any).insert({
    id,
    doc_type: docType,
    title,
    status,
    attempts,
    last_error: error ?? null,
    pdf_file_name: pdfFileName ?? null,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
  if (insertError) throw insertError;
}

/** Browser printing uses the native dialog; named-printer discovery is unavailable. */
export async function listAvailablePrinters(): Promise<PrinterInfo[]> {
  return [];
}

export async function getPrintJobHistory(limit = 100) {
  const { data, error } = await getCloudDataClient()
    .from("print_jobs" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    docType: row.doc_type as string,
    title: row.title as string,
    status: row.status as string,
    attempts: Number(row.attempts),
    lastError: (row.last_error as string) ?? null,
    pdfFileName: (row.pdf_file_name as string) ?? null,
    createdAt: row.created_at as string,
  }));
}
