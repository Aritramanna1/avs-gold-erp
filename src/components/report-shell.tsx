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

export function ReportShell(props: ReportShellProps) {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 print:p-0">
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
