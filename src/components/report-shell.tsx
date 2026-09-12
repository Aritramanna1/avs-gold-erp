import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Download, FileSpreadsheet } from "lucide-react";
import { triggerPrint } from "@/lib/report-engine";
import { useSettings } from "@/lib/settings-store";

interface Branch {
  id: string;
  name: string;
}

interface ReportShellProps {
  title: string;
  subtitle?: string;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  selectedBranch: string;
  onBranchChange: (v: string) => void;
  branches: Branch[];
  onPDF?: () => void;
  onXLSX?: () => void;
  onCSV?: () => void;
  children: React.ReactNode;
}

import { APP_NAME } from "@/lib/app-info";

export function ReportShell(props: ReportShellProps) {
  const branding = useSettings((s) => s.branding);
  const firm = useSettings((s) => s.firm);
  const companyName = firm?.shopName || branding.companyName || APP_NAME;
  const branchName =
    props.branches.find((b) => b.id === props.selectedBranch)?.name || "All Branches";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 print:p-4 print:max-w-none print:m-0 print:space-y-4 print:text-black">
      {/* Print-Only Branded Header */}
      <div className="hidden print:block border-b-2 border-black/80 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto max-w-[120px] object-contain" />
              )}
              <h1 className="text-xl font-bold tracking-tight text-black">{companyName}</h1>
            </div>
            {firm?.tagline && <p className="text-xs text-gray-600">{firm.tagline}</p>}
            {firm?.address && <p className="text-[10px] text-gray-500">{firm.address}</p>}
            {(firm?.phone || firm?.gstin) && (
              <p className="text-[10px] text-gray-500">
                {firm?.phone ? `Phone: ${firm.phone}` : ""}
                {firm?.phone && firm?.gstin ? " | " : ""}
                {firm?.gstin ? `GSTIN: ${firm.gstin}` : ""}
              </p>
            )}
          </div>
          <div className="text-right space-y-0.5">
            <h2 className="text-base font-bold text-black uppercase tracking-wider">{props.title}</h2>
            {props.subtitle && <p className="text-xs text-gray-600 font-medium">{props.subtitle}</p>}
            <p className="text-[10px] text-gray-500 mt-1">
              Period: {props.from} to {props.to} | Branch: {branchName}
            </p>
            <p className="text-[9px] text-gray-400">
              Printed on: {new Date().toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">{props.title}</h1>
          {props.subtitle && <p className="text-sm text-muted-foreground mt-1">{props.subtitle}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              props.onPDF?.();
              triggerPrint();
            }}
          >
            <Printer className="h-4 w-4 mr-1" /> Print / PDF
          </Button>
          {props.onXLSX && (
            <Button variant="outline" size="sm" onClick={props.onXLSX}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          {props.onCSV && (
            <Button variant="outline" size="sm" onClick={props.onCSV}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          )}
        </div>
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end print:hidden">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={props.from}
            onChange={(e) => props.onFromChange(e.target.value)}
            className="h-8 w-36"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={props.to}
            onChange={(e) => props.onToChange(e.target.value)}
            className="h-8 w-36"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Branch</Label>
          <Select value={props.selectedBranch} onValueChange={props.onBranchChange}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {props.branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {props.children}
    </div>
  );
}
