import { getCloudDataClient } from "@/lib/providers/data-provider";
import type { PrintDocType, PrintTemplate } from "./types";

const PRINT_TEMPLATE_READ_LIMIT = 250;

function fromData(row: Record<string, unknown> | null): PrintTemplate | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as PrintTemplate;
  return null;
}

export async function fetchPrintTemplates(
  options: {
    docType?: PrintDocType;
    limit?: number;
  } = {},
): Promise<PrintTemplate[]> {
  const db = getCloudDataClient();
  const { data, error } = await db
    .from("print_templates" as any)
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? PRINT_TEMPLATE_READ_LIMIT);

  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData(row as Record<string, unknown>))
    .filter((row): row is PrintTemplate => row !== null)
    .filter((row) => !options.docType || row.docType === options.docType)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
