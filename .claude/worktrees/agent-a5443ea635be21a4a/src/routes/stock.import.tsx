import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useStock,
  STOCK_LOCATIONS,
  STOCK_LOCATION_LABELS,
  STOCK_STATUS_LABELS,
  type StockLocation,
  type StockStatus,
} from "@/lib/stock-store";
import { Download, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock/import")({
  head: () => ({ meta: [{ title: "Stock Import · MTJ ERP" }] }),
  component: StockImportPage,
});

const TEMPLATE_HEADERS = [
  "itemCode",
  "barcode",
  "itemName",
  "category",
  "purity",
  "grossG",
  "netG",
  "huid",
  "location",
  "status",
  "notes",
];

const STATUS_VALUES: StockStatus[] = ["available", "sold", "reserved", "repair", "scrap"];

interface ParsedRow {
  rowNum: number;
  raw: Record<string, string>;
  errors: string[];
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    return row;
  });
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function validateRow(raw: Record<string, string>): string[] {
  const errors: string[] = [];
  if (!raw.itemName) errors.push("itemName is required");
  if (!raw.category) errors.push("category is required");
  const purity = Number(raw.purity);
  if (!Number.isFinite(purity) || purity <= 0 || purity > 999) errors.push("purity must be 1-999");
  const grossG = Number(raw.grossG);
  if (!Number.isFinite(grossG) || grossG <= 0) errors.push("grossG must be a positive number");
  const netG = Number(raw.netG);
  if (!Number.isFinite(netG) || netG <= 0) errors.push("netG must be a positive number");
  if (Number.isFinite(netG) && Number.isFinite(grossG) && netG > grossG) {
    errors.push("netG cannot exceed grossG");
  }
  if (raw.location && !STOCK_LOCATIONS.includes(raw.location as StockLocation)) {
    errors.push(`location must be one of: ${STOCK_LOCATIONS.join(", ")}`);
  }
  if (raw.status && !STATUS_VALUES.includes(raw.status as StockStatus)) {
    errors.push(`status must be one of: ${STATUS_VALUES.join(", ")}`);
  }
  return errors;
}

function StockImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const validCount = useMemo(() => rows.filter((r) => r.errors.length === 0).length, [rows]);

  function downloadTemplate() {
    const sample = [
      TEMPLATE_HEADERS.join(","),
      "MTJ-2026-0001,,22K Gold Ring,Ring,916,5.500,5.200,HUID12345,counter,available,Sample row — edit or delete",
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock-import-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCSV(text);
      const withValidation: ParsedRow[] = parsed.map((raw, idx) => ({
        rowNum: idx + 2,
        raw,
        errors: validateRow(raw),
      }));
      setRows(withValidation);
      toast(`Parsed ${withValidation.length} rows — ${withValidation.filter((r) => r.errors.length === 0).length} valid.`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;
    for (const row of valid) {
      try {
        const grossMg = Math.round(Number(row.raw.grossG) * 1000);
        const netMg = Math.round(Number(row.raw.netG) * 1000);
        await useStock.getState().add({
          itemCode: row.raw.itemCode || undefined,
          barcode: row.raw.barcode || undefined,
          itemName: row.raw.itemName,
          category: row.raw.category,
          purity: Number(row.raw.purity),
          grossMg,
          netMg,
          huid: row.raw.huid || undefined,
          location: (row.raw.location as StockLocation) || "counter",
          status: (row.raw.status as StockStatus) || "available",
          notes: row.raw.notes || undefined,
        });
        success++;
      } catch (err) {
        console.error("Stock import row failed", row.rowNum, err);
        failed++;
      }
    }
    setResult({ success, failed });
    setRows([]);
    setImporting(false);
    toast.success(`Imported ${success} items${failed > 0 ? `, ${failed} failed` : ""}.`);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Bulk Stock Import"
        subtitle="Import finished stock items from a CSV file. Download the template, fill it in, then upload."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" /> Download Template
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Upload CSV
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        }
      />

      {result && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>
            Import finished: {result.success} succeeded{result.failed > 0 ? `, ${result.failed} failed` : ""}.
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">
              {validCount} of {rows.length} rows valid.
            </div>
            <Button onClick={handleImport} disabled={importing || validCount === 0} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {validCount} Valid Rows
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left sticky top-0 bg-card">
                  <th className="p-2">Row</th>
                  <th className="p-2">Item</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Purity</th>
                  <th className="p-2">Gross/Net (g)</th>
                  <th className="p-2">Location/Status</th>
                  <th className="p-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNum} className="border-b border-border last:border-0">
                    <td className="p-2">{r.rowNum}</td>
                    <td className="p-2">{r.raw.itemName || "—"}</td>
                    <td className="p-2">{r.raw.category || "—"}</td>
                    <td className="p-2">{r.raw.purity || "—"}</td>
                    <td className="p-2">
                      {r.raw.grossG || "—"} / {r.raw.netG || "—"}
                    </td>
                    <td className="p-2">
                      {STOCK_LOCATION_LABELS[r.raw.location as StockLocation] ?? r.raw.location ?? "counter"} /{" "}
                      {STOCK_STATUS_LABELS[r.raw.status as StockStatus] ?? r.raw.status ?? "available"}
                    </td>
                    <td className="p-2">
                      {r.errors.length === 0 ? (
                        <Badge className="bg-green-600 hover:bg-green-600">OK</Badge>
                      ) : (
                        <div className="flex items-start gap-1 text-destructive">
                          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{r.errors.join("; ")}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rows.length === 0 && !result && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Download the template, fill in your stock items, then upload the CSV to preview and import.
        </div>
      )}
    </div>
  );
}
