/**
 * Configurable Books & Dynamic Formula Columns Designer
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 * Master Reference: docs/MASTER/CUSTOM_FORMULA_ENGINE.md
 *
 * "A Book should be a controlled view over authoritative transactions/ledgers, not another source of truth.
 * Allow: Add Book, Clone, Rename, Add/Remove Columns, Reorder, Add Custom Calculations (e.g. Worker Eligible Weight = Net - Chain)."
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Calculator,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Search,
  CheckCircle2,
  Eye,
  Layers,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { evaluateSafeFormula } from "@/lib/formula-engine";
import { ensureCustomBooksLoaded, useCustomBooksStore } from "@/lib/custom-books-store";

export interface BookColumnConfig {
  id: string;
  fieldCode: string;
  label: string;
  sourceType: "base_field" | "calculated_formula";
  formulaExpression?: string;
  format: "text" | "weight_g" | "currency_inr" | "percentage" | "date";
  isVisible: boolean;
  isTotalAggregated?: boolean;
}

export interface CustomBookDefinition {
  id: string;
  code: string;
  name: string;
  baseSource: "manufacturing" | "worker_gold" | "outside_work" | "billing" | "vault";
  description: string;
  columns: BookColumnConfig[];
  filterGroup?: string;
  isSystem: boolean;
  isActive: boolean;
}

const PRESET_BOOKS: CustomBookDefinition[] = [
  {
    id: "book_mfg_default",
    code: "MFG_ELIGIBLE_BOOK",
    name: "Manufacturing Eligible Weight Book",
    baseSource: "manufacturing",
    description:
      "Workshop production ledger deducting chain and findings weight from artisan remuneration.",
    columns: [
      {
        id: "c1",
        fieldCode: "job_number",
        label: "Job Card No",
        sourceType: "base_field",
        format: "text",
        isVisible: true,
      },
      {
        id: "c2",
        fieldCode: "karigar_name",
        label: "Karigar / Artisan",
        sourceType: "base_field",
        format: "text",
        isVisible: true,
      },
      {
        id: "c3",
        fieldCode: "gross_weight",
        label: "Gross Wt (g)",
        sourceType: "base_field",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
      {
        id: "c4",
        fieldCode: "net_weight",
        label: "Net Wt (g)",
        sourceType: "base_field",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
      {
        id: "c5",
        fieldCode: "chain_weight",
        label: "Chain / Machine Part (g)",
        sourceType: "base_field",
        format: "weight_g",
        isVisible: true,
      },
      {
        id: "c6",
        fieldCode: "worker_eligible_wt",
        label: "Worker Eligible Wt (g)",
        sourceType: "calculated_formula",
        formulaExpression: "{net_weight} - {chain_weight}",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
      {
        id: "c7",
        fieldCode: "making_charge_payable",
        label: "Labour Payable (₹)",
        sourceType: "calculated_formula",
        formulaExpression: "({net_weight} - {chain_weight}) * {labour_rate}",
        format: "currency_inr",
        isVisible: true,
        isTotalAggregated: true,
      },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    id: "book_mina_register",
    code: "MINA_SUBCONTRACT_REGISTER",
    name: "Mina & Enamel Outside Register",
    baseSource: "outside_work",
    description: "Subcontractor ledger tracking enamel loss allowances and turnarounds.",
    columns: [
      {
        id: "m1",
        fieldCode: "challan_no",
        label: "Challan Ref",
        sourceType: "base_field",
        format: "text",
        isVisible: true,
      },
      {
        id: "m2",
        fieldCode: "vendor_name",
        label: "Mina Artisan",
        sourceType: "base_field",
        format: "text",
        isVisible: true,
      },
      {
        id: "m3",
        fieldCode: "issued_gross_wt",
        label: "Issued Wt (g)",
        sourceType: "base_field",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
      {
        id: "m4",
        fieldCode: "received_gross_wt",
        label: "Received Wt (g)",
        sourceType: "base_field",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
      {
        id: "m5",
        fieldCode: "enamel_weight_added",
        label: "Mina Added Wt (g)",
        sourceType: "calculated_formula",
        formulaExpression: "{received_gross_wt} - {issued_gross_wt}",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
    ],
    isSystem: false,
    isActive: true,
  },
];

// Sample live data rows for previewing the book calculation
const SAMPLE_PREVIEW_ROWS = [
  {
    job_number: "JOB-2026-081",
    karigar_name: "Rahul Verma (Bench 3)",
    gross_weight: 18.5,
    net_weight: 17.2,
    chain_weight: 4.5,
    labour_rate: 450,
  },
  {
    job_number: "JOB-2026-082",
    karigar_name: "Mukesh Soni (Polki)",
    gross_weight: 32.4,
    net_weight: 28.0,
    chain_weight: 0.0,
    labour_rate: 600,
  },
  {
    job_number: "JOB-2026-083",
    karigar_name: "Arun Karigar (Casting)",
    gross_weight: 12.8,
    net_weight: 11.5,
    chain_weight: 2.1,
    labour_rate: 400,
  },
];

export function CustomBooksDesigner() {
  const { books, hydrated, hydrate, saveBook, addBook } = useCustomBooksStore();
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isNewBookModalOpen, setIsNewBookModalOpen] = useState(false);

  useEffect(() => {
    void ensureCustomBooksLoaded();
  }, []);

  useEffect(() => {
    if (hydrated && books.length > 0 && !selectedBookId) {
      setSelectedBookId(books[0].id);
    }
  }, [hydrated, books, selectedBookId]);

  const activeBook = books.find((b) => b.id === selectedBookId) || books[0];

  const persistActiveBook = useCallback(
    async (nextColumns: BookColumnConfig[]) => {
      const book = books.find((b) => b.id === selectedBookId) || books[0];
      if (!book) return;
      await saveBook({ ...book, columns: nextColumns });
    },
    [books, saveBook, selectedBookId],
  );

  // New Book Form
  const [newBookName, setNewBookName] = useState("");
  const [newBookCode, setNewBookCode] = useState("");
  const [newBookSource, setNewBookSource] =
    useState<CustomBookDefinition["baseSource"]>("manufacturing");
  const [newBookDesc, setNewBookDesc] = useState("");

  // Column Editor Form
  const [colLabel, setColLabel] = useState("");
  const [colFieldCode, setColFieldCode] = useState("");
  const [colSourceType, setColSourceType] = useState<"base_field" | "calculated_formula">(
    "calculated_formula",
  );
  const [colFormula, setColFormula] = useState("");
  const [colFormat, setColFormat] = useState<BookColumnConfig["format"]>("weight_g");
  const [colAggregated, setColAggregated] = useState(true);

  const handleAddColumn = () => {
    if (!colLabel.trim()) {
      toast.error("Column label is required.");
      return;
    }
    const cleanCode = (colFieldCode.trim() || colLabel.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");

    const newCol: BookColumnConfig = {
      id: `col_${Date.now()}`,
      fieldCode: cleanCode,
      label: colLabel.trim(),
      sourceType: colSourceType,
      formulaExpression: colSourceType === "calculated_formula" ? colFormula.trim() : undefined,
      format: colFormat,
      isVisible: true,
      isTotalAggregated: colAggregated,
    };

    const updated = [...activeBook.columns, newCol];
    void persistActiveBook(updated);
    setIsColumnModalOpen(false);
    setColLabel("");
    setColFieldCode("");
    setColFormula("");
    toast.success(`Added column "${newCol.label}" to ${activeBook.name}.`);
  };

  const handleRemoveColumn = (colId: string) => {
    const updated = activeBook.columns.filter((c) => c.id !== colId);
    void persistActiveBook(updated);
    toast.success("Column removed.");
  };

  const handleMoveColumn = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= activeBook.columns.length) return;

    const newCols = [...activeBook.columns];
    const temp = newCols[index];
    newCols[index] = newCols[targetIdx];
    newCols[targetIdx] = temp;

    void persistActiveBook(newCols);
  };

  const handleCloneBook = (book: CustomBookDefinition) => {
    const cloned: CustomBookDefinition = {
      ...book,
      id: `book_custom_${Date.now()}`,
      code: `${book.code}_COPY`,
      name: `${book.name} (Custom Copy)`,
      isSystem: false,
    };
    void (async () => {
      const created = await addBook(cloned);
      if (created) setSelectedBookId(created.id);
    })();
    toast.success(`Cloned "${book.name}".`);
  };

  const handleSaveNewBook = () => {
    if (!newBookName.trim()) {
      toast.error("Book name is required.");
      return;
    }
    const code = (newBookCode.trim() || newBookName.trim())
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");

    const newBook: CustomBookDefinition = {
      id: `book_${Date.now()}`,
      code,
      name: newBookName.trim(),
      baseSource: newBookSource,
      description: newBookDesc.trim(),
      columns: [
        {
          id: "c1",
          fieldCode: "record_ref",
          label: "Reference No",
          sourceType: "base_field",
          format: "text",
          isVisible: true,
        },
        {
          id: "c2",
          fieldCode: "party_name",
          label: "Party / Worker",
          sourceType: "base_field",
          format: "text",
          isVisible: true,
        },
        {
          id: "c3",
          fieldCode: "gross_weight",
          label: "Gross Weight (g)",
          sourceType: "base_field",
          format: "weight_g",
          isVisible: true,
          isTotalAggregated: true,
        },
      ],
      isSystem: false,
      isActive: true,
    };

    void (async () => {
      const created = await addBook(newBook);
      if (created) {
        setSelectedBookId(created.id);
        setIsNewBookModalOpen(false);
        toast.success(`Book "${newBook.name}" created.`);
      }
    })();
  };

  // Preview computations
  const previewData = useMemo(() => {
    return SAMPLE_PREVIEW_ROWS.map((row) => {
      const computedRow: Record<string, any> = { ...row };
      activeBook?.columns.forEach((col) => {
        if (col.sourceType === "calculated_formula" && col.formulaExpression) {
          const evalRes = evaluateSafeFormula(col.formulaExpression, row);
          computedRow[col.fieldCode] = evalRes.success ? evalRes.value : 0;
        }
      });
      return computedRow;
    });
  }, [activeBook]);

  // Aggregate Totals
  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    activeBook?.columns.forEach((col) => {
      if (col.isTotalAggregated) {
        sums[col.fieldCode] = previewData.reduce(
          (acc, r) => acc + (parseFloat(r[col.fieldCode]) || 0),
          0,
        );
      }
    });
    return sums;
  }, [activeBook, previewData]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <Card className="p-5 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Configurable Books & Formula Columns Designer
                <Badge
                  variant="outline"
                  className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                >
                  AST Formula Engine
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize operational registers with bespoke columns, safe mathematical calculations
                (e.g. Worker Eligible Wt = Net - Chain), and instant totals.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setNewBookName("");
              setNewBookCode("");
              setNewBookDesc("");
              setIsNewBookModalOpen(true);
            }}
            className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Create Custom Book
          </Button>
        </div>
      </Card>

      {/* Book Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {books.map((b) => (
          <Button
            key={b.id}
            variant={selectedBookId === b.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedBookId(b.id)}
            className={`text-xs h-8 ${
              selectedBookId === b.id
                ? "bg-amber-500 text-black font-semibold hover:bg-amber-600"
                : ""
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            {b.name}
          </Button>
        ))}
      </div>

      {/* Active Book Designer */}
      {activeBook && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Columns & Formula Rules */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-sm text-foreground">{activeBook.name}</h4>
                <span className="text-[11px] font-mono text-amber-600">
                  code: {activeBook.code}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCloneBook(activeBook)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Clone Book"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{activeBook.description}</p>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Column Layout ({activeBook.columns.length})
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsColumnModalOpen(true)}
                  className="h-6 text-[11px] px-2 gap-1 text-amber-600 border-amber-500/30"
                >
                  <Plus className="h-3 w-3" /> Add Column
                </Button>
              </div>

              <div className="rounded-md border divide-y text-xs">
                {activeBook.columns.map((col, idx) => (
                  <div
                    key={col.id}
                    className="p-2.5 flex items-center justify-between hover:bg-muted/20"
                  >
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        {col.label}
                        {col.sourceType === "calculated_formula" && (
                          <Badge
                            variant="outline"
                            className="text-[9px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                          >
                            Formula
                          </Badge>
                        )}
                      </div>
                      {col.formulaExpression && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {col.formulaExpression}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMoveColumn(idx, "up")}
                        disabled={idx === 0}
                        className="h-6 w-6 p-0 text-muted-foreground"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMoveColumn(idx, "down")}
                        disabled={idx === activeBook.columns.length - 1}
                        className="h-6 w-6 p-0 text-muted-foreground"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveColumn(col.id)}
                        className="h-6 w-6 p-0 text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Right: Live Interactive Register Preview */}
          <Card className="lg:col-span-2 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-sm text-foreground">
                  Live Book Calculation Preview
                </span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
              >
                Formula Live Evaluator Active
              </Badge>
            </div>

            {/* Simulated Live Table */}
            <div className="overflow-x-auto rounded-md border text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted text-muted-foreground font-semibold border-b">
                    {activeBook.columns.map((col) => (
                      <th key={col.id} className="p-2.5 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewData.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-muted/20">
                      {activeBook.columns.map((col) => {
                        const val = row[col.fieldCode];
                        return (
                          <td key={col.id} className="p-2.5 font-mono whitespace-nowrap">
                            {col.format === "weight_g" && typeof val === "number"
                              ? `${val.toFixed(3)} g`
                              : col.format === "currency_inr" && typeof val === "number"
                                ? `₹${val.toLocaleString("en-IN")}`
                                : String(val ?? "-")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {/* Aggregated Totals Footer */}
                <tfoot>
                  <tr className="bg-amber-500/10 font-bold text-foreground border-t border-amber-500/30">
                    {activeBook.columns.map((col, idx) => {
                      if (idx === 0)
                        return (
                          <td key={col.id} className="p-2.5">
                            Total
                          </td>
                        );
                      if (col.isTotalAggregated) {
                        const sum = totals[col.fieldCode] || 0;
                        return (
                          <td key={col.id} className="p-2.5 font-mono text-amber-600">
                            {col.format === "weight_g"
                              ? `${sum.toFixed(3)} g`
                              : col.format === "currency_inr"
                                ? `₹${sum.toLocaleString("en-IN")}`
                                : sum}
                          </td>
                        );
                      }
                      return (
                        <td key={col.id} className="p-2.5">
                          -
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              * Calculations compute dynamically in real-time. When printed or exported to Excel,
              these exact formula values are locked.
            </p>
          </Card>
        </div>
      )}

      {/* ── Modal: Add Column / Custom Formula ────────────────────────────── */}
      <Dialog open={isColumnModalOpen} onOpenChange={setIsColumnModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Calculator className="h-5 w-5 text-amber-500" />
              Add Column / Custom Calculation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Column Header Label *</Label>
              <Input
                placeholder="e.g. Worker Eligible Weight (g)"
                value={colLabel}
                onChange={(e) => {
                  setColLabel(e.target.value);
                  setColFieldCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                }}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Column Source Type</Label>
              <select
                value={colSourceType}
                onChange={(e) => setColSourceType(e.target.value as any)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
              >
                <option value="calculated_formula">Dynamic AST Formula (Calculated)</option>
                <option value="base_field">Direct Base Database Field</option>
              </select>
            </div>

            {colSourceType === "calculated_formula" && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/20">
                <Label className="text-xs font-semibold">Mathematical Formula Expression</Label>
                <Input
                  placeholder="e.g. {net_weight} - {chain_weight}"
                  value={colFormula}
                  onChange={(e) => setColFormula(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <div className="text-[10px] text-muted-foreground space-y-1">
                  <div>Available Variables:</div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      "{gross_weight}",
                      "{net_weight}",
                      "{chain_weight}",
                      "{labour_rate}",
                      "{touch}",
                      "{stone_weight}",
                    ].map((v) => (
                      <span
                        key={v}
                        onClick={() => setColFormula(`${colFormula} ${v}`.trim())}
                        className="bg-muted px-1 py-0.5 rounded cursor-pointer hover:bg-amber-500/20 font-mono"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Format Display</Label>
                <select
                  value={colFormat}
                  onChange={(e) => setColFormat(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  <option value="weight_g">Gold Weight (3 Decimals g)</option>
                  <option value="currency_inr">Indian Currency (₹)</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="text">Plain Text</option>
                </select>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={colAggregated}
                    onChange={(e) => setColAggregated(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-xs">Include in Column Totals</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsColumnModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddColumn}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Add to Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Create New Custom Book ────────────────────────────────── */}
      <Dialog open={isNewBookModalOpen} onOpenChange={setIsNewBookModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-500" />
              Define New Operational Book / Register
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Book Name *</Label>
              <Input
                placeholder="e.g. Polishing Loss Register"
                value={newBookName}
                onChange={(e) => {
                  setNewBookName(e.target.value);
                  setNewBookCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"));
                }}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Base Transaction Source</Label>
              <select
                value={newBookSource}
                onChange={(e) => setNewBookSource(e.target.value as any)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
              >
                <option value="manufacturing">Workshop Manufacturing & Jobs</option>
                <option value="worker_gold">Worker Gold & Bench Custody</option>
                <option value="outside_work">Outside Subcontract Work</option>
                <option value="billing">Sales Invoices & Billing</option>
                <option value="vault">Vault & Bullion Movement</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Explain the purpose of this book..."
                value={newBookDesc}
                onChange={(e) => setNewBookDesc(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsNewBookModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveNewBook}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Create Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
