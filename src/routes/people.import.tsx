import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePeople, type PersonType } from "@/lib/people-store";
import { Download, Upload, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/people/import")({
  head: () => ({ meta: [{ title: "Bulk People Import · AVS Gold ERP" }] }),
  component: PeopleImportPage,
});

const TEMPLATE_HEADERS = [
  "type",
  "fullName",
  "phone",
  "altPhone",
  "email",
  "currentAddress",
  "villageCity",
  "state",
  "gstin",
  "pan",
];

const PERSON_TYPES: PersonType[] = [
  "customer",
  "firm_customer",
  "karigar",
  "worker",
  "employee",
  "vendor",
  "outside_worker",
];

interface ParsedRow {
  rowNum: number;
  raw: Record<string, string>;
  errors: string[];
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

function validateRow(raw: Record<string, string>): string[] {
  const errors: string[] = [];
  if (!raw.fullName) errors.push("fullName is required");
  if (!raw.phone || !/^\d{7,15}$/.test(raw.phone.replace(/[\s+-]/g, ""))) {
    errors.push("phone is required and must be 7-15 digits");
  }
  if (raw.type && !PERSON_TYPES.includes(raw.type as PersonType)) {
    errors.push(`type must be one of: ${PERSON_TYPES.join(", ")}`);
  }
  return errors;
}

function PeopleImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const validCount = useMemo(() => rows.filter((r) => r.errors.length === 0).length, [rows]);

  function downloadTemplate() {
    const sample = [
      TEMPLATE_HEADERS.join(","),
      'customer,Rahul Sharma,9876543210,,rahul@example.com,"12 MG Road",Pune,Maharashtra,,',
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "people-import-template.csv";
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
      toast(
        `Parsed ${withValidation.length} rows — ${withValidation.filter((r) => r.errors.length === 0).length} valid.`,
      );
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
        await usePeople.getState().add({
          type: (row.raw.type as PersonType) || "customer",
          active: true,
          fullName: row.raw.fullName,
          phone: row.raw.phone,
          altPhone: row.raw.altPhone || undefined,
          email: row.raw.email || undefined,
          currentAddress: row.raw.currentAddress || undefined,
          villageCity: row.raw.villageCity || undefined,
          state: row.raw.state || undefined,
          gstin: row.raw.gstin || undefined,
          pan: row.raw.pan || undefined,
        });
        success++;
      } catch (err) {
        console.error("People import row failed", row.rowNum, err);
        failed++;
      }
    }
    setResult({ success, failed });
    setRows([]);
    setImporting(false);
    toast.success(`Imported ${success} people${failed > 0 ? `, ${failed} failed` : ""}.`);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Bulk People Import"
        subtitle="Import customers, karigars, workers or vendors from a CSV file. Download the template, fill it in, then upload."
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
                    <th className="p-2">Type</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNum} className="border-b border-border last:border-0">
                      <td className="p-2">{r.rowNum}</td>
                      <td className="p-2">{r.raw.type || "customer"}</td>
                      <td className="p-2">{r.raw.fullName || "—"}</td>
                      <td className="p-2">{r.raw.phone || "—"}</td>
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
          Download the template, fill in your people records, then upload the CSV to preview and
          import.
        </div>
      )}
    </div>
  );
}
