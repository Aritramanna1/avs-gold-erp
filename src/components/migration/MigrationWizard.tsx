import React, { useState } from "react";
import { MIGRATION_STAGES, useMigrationStore, type MigrationStageId } from "@/lib/migration-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  ArrowRight,
  ArrowLeft,
  Lock,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
} from "lucide-react";

export function MigrationWizard() {
  const {
    activeBatch,
    currentStageIndex,
    setCurrentStageIndex,
    generateCsvTemplate,
    importCsvToStage,
    validateStage,
    runDryRunSimulation,
    executeAuditFreeze,
    resetBatch,
  } = useMigrationStore();

  const currentStage = MIGRATION_STAGES[currentStageIndex];
  const stageData = activeBatch.stagesData[currentStage.id];
  const [ceoSignature, setCeoSignature] = useState("");
  const [freezeSuccess, setFreezeSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const handleDownloadTemplate = (stageId: MigrationStageId) => {
    const csvContent = generateCsvTemplate(stageId);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ornexa_stage_${stageId}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importCsvToStage(currentStage.id, content);
        if (res.success) {
          setUploadMessage(`Successfully parsed ${res.rowCount} records.`);
          validateStage(currentStage.id);
        } else {
          setUploadMessage(`Import failed: ${res.errors.join(", ")}`);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSimulate = () => {
    runDryRunSimulation();
  };

  const handleExecuteFreeze = async () => {
    if (!ceoSignature.trim()) {
      alert("Please enter the authorized CEO/Admin signature phrase.");
      return;
    }
    const res = await executeAuditFreeze(ceoSignature);
    if (res.success) {
      setFreezeSuccess(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-semibold text-sm">
                13
              </span>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Ornexa 13-Stage Opening Balance & Migration Wizard
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Authoritative onboarding engine for ingesting historical data, dual-ledger opening
              balances, stock tags, and active WIP.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant={
                activeBatch.status === "FROZEN_LIVE"
                  ? "default"
                  : activeBatch.status === "SIMULATED"
                    ? "secondary"
                    : "outline"
              }
              className="text-xs px-3 py-1 font-mono"
            >
              Status: {activeBatch.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={resetBatch}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset Batch
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar Step Navigation + Stage Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Navigation: 13 Stages */}
        <div className="lg:col-span-4 rounded-xl border border-border/80 bg-card p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-border/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Migration Stages
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {currentStageIndex + 1} / {MIGRATION_STAGES.length}
            </span>
          </div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {MIGRATION_STAGES.map((s, idx) => {
              const data = activeBatch.stagesData[s.id];
              const isSelected = idx === currentStageIndex;
              const hasData = (data?.rows.length || 0) > 0;
              const isValid = data?.status === "validated";
              const isError = data?.status === "error";

              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStageIndex(idx)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-all text-xs flex items-center justify-between gap-2 ${
                    isSelected
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-mono">
                      {s.stageNumber}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </div>
                  <div className="shrink-0 flex items-center">
                    {isValid && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    {isError && <AlertCircle className="h-3.5 w-3.5 text-rose-500" />}
                    {!isValid && !isError && hasData && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1">
                        {data.rows.length}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content Area: Active Stage Details & Actions */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm space-y-6">
            {/* Stage Title Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    Stage {currentStage.stageNumber} of 13
                  </Badge>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {currentStage.category.replace("_", " ")}
                  </Badge>
                </div>
                <h2 className="text-lg font-bold text-foreground mt-2">{currentStage.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{currentStage.shortDesc}</p>
              </div>

              {/* Download CSV Template */}
              {currentStage.id !== "validation_audit_freeze" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadTemplate(currentStage.id)}
                  className="gap-1.5 text-xs shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Template
                </Button>
              )}
            </div>

            {/* Stage Specific Body */}
            {currentStage.id === "validation_audit_freeze" ? (
              <div className="space-y-6">
                <div className="rounded-lg bg-muted/40 p-4 border border-border/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      Dual-Ledger Dry-Run Simulation
                    </h3>
                    <Button size="sm" onClick={handleSimulate} className="text-xs gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Run Simulation
                    </Button>
                  </div>

                  {activeBatch.dryRunSimulation && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div className="rounded-lg border bg-card p-3">
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">
                          Total Opening Assets (₹)
                        </p>
                        <p className="text-lg font-bold text-emerald-600">
                          ₹{activeBatch.dryRunSimulation.totalAssetsInr.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">
                          Total Opening Liabilities (₹)
                        </p>
                        <p className="text-lg font-bold text-rose-600">
                          ₹
                          {activeBatch.dryRunSimulation.totalLiabilitiesInr.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">
                          Opening Equity Reserve (₹)
                        </p>
                        <p className="text-lg font-bold text-foreground">
                          ₹
                          {activeBatch.dryRunSimulation.openingEquityReserveInr.toLocaleString(
                            "en-IN",
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-card p-3 md:col-span-3">
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">
                          Net Fine Gold Balance Position
                        </p>
                        <p className="text-base font-semibold text-amber-500">
                          {activeBatch.dryRunSimulation.netFineGoldBalanceG.toFixed(3)} g (Pure 24K
                          Equivalent)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audit Freeze Execution Box */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-amber-600">
                    <Lock className="h-4 w-4" /> Cryptographic Migration Audit Freeze
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Executing the freeze locks all 13 stages into an immutable migration batch,
                    writes initial live double-entry ledgers, and transitions the workshop to live
                    ERP operations.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Input
                      placeholder="Enter authorized CEO/Admin name to sign"
                      value={ceoSignature}
                      onChange={(e) => setCeoSignature(e.target.value)}
                      className="text-xs h-9"
                    />
                    <Button
                      onClick={handleExecuteFreeze}
                      disabled={activeBatch.status === "FROZEN_LIVE" || !ceoSignature.trim()}
                      className="w-full sm:w-auto text-xs shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {activeBatch.status === "FROZEN_LIVE"
                        ? "Migration Frozen"
                        : "Sign & Freeze Migration"}
                    </Button>
                  </div>
                  {freezeSuccess && (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Migration batch successfully frozen into live ledgers. Batch ID:{" "}
                      {activeBatch.id}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Upload Zone */}
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors bg-muted/20">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    Upload CSV file for Stage {currentStage.stageNumber}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 mb-4">
                    Download the pre-formatted CSV template above, fill in historical records, and
                    drop it here.
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                </div>

                {uploadMessage && (
                  <p className="text-xs text-muted-foreground italic">{uploadMessage}</p>
                )}

                {/* Parsed Data Preview Table */}
                {stageData && stageData.rows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Parsed Records ({stageData.rows.length})
                      </h4>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => validateStage(currentStage.id)}
                        className="text-xs h-7"
                      >
                        Re-validate
                      </Button>
                    </div>

                    {stageData.errors.length > 0 && (
                      <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Validation Issues Detected:
                        </div>
                        <ul className="list-disc pl-5 space-y-0.5">
                          {stageData.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="rounded-lg border overflow-x-auto max-h-[300px]">
                      <table className="w-full text-xs">
                        <thead className="bg-muted text-muted-foreground font-medium sticky top-0 border-b">
                          <tr>
                            <th className="py-2 px-3 text-left">#</th>
                            {currentStage.csvTemplateHeaders.map((h) => (
                              <th key={h} className="py-2 px-3 text-left">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {stageData.rows.slice(0, 50).map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-muted/40">
                              <td className="py-1.5 px-3 font-mono text-muted-foreground">
                                {rIdx + 1}
                              </td>
                              {currentStage.csvTemplateHeaders.map((h) => (
                                <td key={h} className="py-1.5 px-3 whitespace-nowrap">
                                  {row[h] || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step Progression Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStageIndex(Math.max(0, currentStageIndex - 1))}
                disabled={currentStageIndex === 0}
                className="text-xs gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Previous Stage
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setCurrentStageIndex(Math.min(MIGRATION_STAGES.length - 1, currentStageIndex + 1))
                }
                disabled={currentStageIndex === MIGRATION_STAGES.length - 1}
                className="text-xs gap-1.5"
              >
                Next Stage <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
