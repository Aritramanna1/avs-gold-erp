/**
 * Reliable print job history.
 *
 * Every print attempt is recorded in Supabase `print_jobs`. Browser printing
 * and the optional desktop bridge stay as-is; only the durable history moved
 * out of the retired local SQLite layer.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

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

interface MtjDesktopPrintApi {
  print: {
    listPrinters(): Promise<PrinterInfo[]>;
    printHtml(
      html: string,
      options?: { silent?: boolean; printerName?: string },
    ): Promise<{ success: boolean; error?: string }>;
  };
}

function getDesktopApi(): MtjDesktopPrintApi | null {
  return typeof window !== "undefined" && "mtjDesktop" in window
    ? (window as unknown as { mtjDesktop: MtjDesktopPrintApi }).mtjDesktop
    : null;
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
  const now = new Date().toISOString();
  const { error: saveError } = await (supabase as any).from("print_jobs").upsert({
    id,
    doc_type: docType,
    title,
    status,
    attempts,
    last_error: error ?? null,
    pdf_file_name: pdfFileName ?? null,
    created_at: now,
    completed_at: now,
  });
  if (saveError) throw new Error(saveError.message);
}

export async function listAvailablePrinters(): Promise<PrinterInfo[]> {
  const desktop = getDesktopApi();
  if (!desktop) return [];
  return desktop.print.listPrinters();
}

export async function getPrintJobHistory(limit = 100): Promise<
  Array<{
    id: string;
    docType: string;
    title: string;
    status: string;
    attempts: number;
    lastError: string | null;
    pdfFileName: string | null;
    createdAt: string;
  }>
> {
  const { data, error } = await (supabase as any)
    .from("print_jobs")
    .select("id,doc_type,title,status,attempts,last_error,pdf_file_name,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
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
