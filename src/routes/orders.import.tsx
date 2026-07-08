import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrders, type OrderType, type Priority } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { fineGoldMg } from "@/lib/gold";
import { Download, Upload, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/orders/import")({
  head: () => ({ meta: [{ title: "Bulk Orders Import · AVS Gold ERP" }] }),
  component: OrdersImportPage,
});

const TEMPLATE_HEADERS = [
  "customerPhone",
  "type",
  "priority",
  "expectedDelivery",
  "itemName",
  "category",
  "quantity",
  "metal",
  "metalColor",
  "purity",
  "grossG",
  "netG",
  "expectedWastagePct",
  "advanceCashRupees",
  "notes",
];

const ORDER_TYPES: OrderType[] = ["custom", "repair", "polishing", "ready_stock", "wholesale"];
const PRIORITIES: Priority[] = ["normal", "high", "urgent"];

interface ParsedRow {
  rowNum: number;
  raw: Record<string, string>;
  errors: string[];
  customerId?: string;
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

function OrdersImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const people = usePeople((s) => s.people);

  const validCount = useMemo(() => rows.filter((r) => r.errors.length === 0).length, [rows]);

  function downloadTemplate() {
    const sample = [
      TEMPLATE_HEADERS.join(","),
      "9876543210,custom,normal,2026-08-15,22K Ring,Ring,1,gold,yellow,916,5.500,5.200,3,5000,Sample row — edit or delete",
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders-import-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function validateRow(raw: Record<string, string>): { errors: string[]; customerId?: string } {
    const errors: string[] = [];
    const phone = (raw.customerPhone ?? "").replace(/\D/g, "");
    const customer = people.find((p) => p.phone.replace(/\D/g, "") === phone);
    if (!phone) errors.push("customerPhone is required");
    else if (!customer)
      errors.push(`no customer found with phone ${raw.customerPhone} — import that customer first`);
    if (raw.type && !ORDER_TYPES.includes(raw.type as OrderType)) {
      errors.push(`type must be one of: ${ORDER_TYPES.join(", ")}`);
    }
    if (raw.priority && !PRIORITIES.includes(raw.priority as Priority)) {
      errors.push(`priority must be one of: ${PRIORITIES.join(", ")}`);
    }
    if (!raw.itemName) errors.push("itemName is required");
    if (!raw.category) errors.push("category is required");
    const purity = Number(raw.purity);
    if (!Number.isFinite(purity) || purity <= 0 || purity > 999)
      errors.push("purity must be 1-999");
    const grossG = Number(raw.grossG);
    if (!Number.isFinite(grossG) || grossG <= 0) errors.push("grossG must be a positive number");
    const netG = Number(raw.netG);
    if (!Number.isFinite(netG) || netG <= 0) errors.push("netG must be a positive number");
    return { errors, customerId: customer?.id };
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCSV(text);
      const withValidation: ParsedRow[] = parsed.map((raw, idx) => {
        const { errors, customerId } = validateRow(raw);
        return { rowNum: idx + 2, raw, errors, customerId };
      });
      setRows(withValidation);
      toast(
        `Parsed ${withValidation.length} rows — ${withValidation.filter((r) => r.errors.length === 0).length} valid.`,
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.errors.length === 0 && r.customerId);
    if (valid.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;
    for (const row of valid) {
      try {
        const grossMg = Math.round(Number(row.raw.grossG) * 1000);
        const netMg = Math.round(Number(row.raw.netG) * 1000);
        const purity = Number(row.raw.purity);
        // Imported orders previously computed fine gold with /1000 while the
        // rest of the order lifecycle (issues, returns, settlement) uses
        // gold.ts's /999 convention — a permanent mismatch for every bulk-
        // imported row. Row-level try/catch above makes it safe to let a
        // malformed purity value (out of 0..999) fail just this one row.
        const fineMg = fineGoldMg(netMg, purity);
        const wastagePct = Number(row.raw.expectedWastagePct) || 0;
        const advanceRupees = Number(row.raw.advanceCashRupees) || 0;
        await useOrders.getState().add(
          {
            // orderNo omitted — store auto-assigns the next sequential number
            // for us (see orders-store.ts add()); undefined isn't assignable
            // to the declared (required-string) shape, so this call is cast
            // below rather than threading a fake placeholder number through.
            orderNo: undefined as unknown as string,
            type: (row.raw.type as OrderType) || "custom",
            status: "confirmed",
            customerId: row.customerId!,
            expectedDelivery: row.raw.expectedDelivery || undefined,
            priority: (row.raw.priority as Priority) || "normal",
            source: "manual",
            design: { notes: row.raw.notes || undefined },
            item: {
              itemName: row.raw.itemName,
              category: row.raw.category,
              quantity: Number(row.raw.quantity) || 1,
              metal: row.raw.metal || "gold",
              metalColor: row.raw.metalColor || "yellow",
              purity,
              grossMg,
              lessMg: 0,
              netMg,
              fineMg,
              expectedWastagePct: wastagePct,
              expectedWastageMg: Math.round((netMg * wastagePct) / 100),
            },
            advance: {
              cashPaise: Math.round(advanceRupees * 100),
              goldGrossMg: 0,
              goldFineMg: 0,
            },
          },
          { silent: true },
        );
        success++;
      } catch (err) {
        console.error("Order import row failed", row.rowNum, err);
        failed++;
      }
    }
    setResult({ success, failed });
    setRows([]);
    setImporting(false);
    toast.success(
      `Imported ${success} order(s)${failed > 0 ? `, ${failed} failed` : ""}. No confirmation messages were sent to customers.`,
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Bulk Orders Import"
        subtitle="Import historical or bulk orders from a CSV file. The customer must already exist (match by phone) — import people first if needed. No WhatsApp confirmation is sent for imported orders."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" /> Download Template
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        }
      />

      {result && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-4">
          Import finished: {result.success} succeeded
          {result.failed > 0 ? `, ${result.failed} failed` : ""}.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">
              {validCount} of {rows.length} rows valid.
            </div>
            <Button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="gap-2"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Import {validCount} Valid Rows
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden max-h-[500px] overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left sticky top-0 bg-card">
                    <th className="p-2">Row</th>
                    <th className="p-2">Customer Phone</th>
                    <th className="p-2">Item</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNum} className="border-b border-border last:border-0">
                      <td className="p-2">{r.rowNum}</td>
                      <td className="p-2">{r.raw.customerPhone || "—"}</td>
                      <td className="p-2">{r.raw.itemName || "—"}</td>
                      <td className="p-2">{r.raw.type || "custom"}</td>
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
          </div>
        </>
      )}

      {rows.length === 0 && !result && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Download the template, fill in your orders (matching customers by phone), then upload the
          CSV.
        </div>
      )}
    </div>
  );
}
