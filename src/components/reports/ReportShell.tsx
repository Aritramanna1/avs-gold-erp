import type { ReactNode } from "react";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
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
import {
  rangeForPeriod,
  thisMonthRange,
  type DateRange,
  type ReportPeriod,
} from "@/lib/report-engine";

export type ReportShellProps = {
  title: string;
  description?: string;
  variant?: "ledger" | "operational" | "report";
  period?: ReportPeriod;
  onPeriodChange?: (p: ReportPeriod) => void;
  customRange?: DateRange;
  onCustomRangeChange?: (r: DateRange) => void;
  openingLabel?: string;
  closingLabel?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onPrint?: () => void;
  onEmail?: () => void;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

/** Shared report chrome: period filters, SoT badge, opening/closing strip. */
export function ReportShell({
  title,
  description,
  variant = "report",
  period = "monthly",
  onPeriodChange,
  customRange = thisMonthRange(),
  onCustomRangeChange,
  openingLabel,
  closingLabel,
  onRefresh,
  onExport,
  onPrint,
  onEmail,
  filters,
  footer,
  children,
}: ReportShellProps) {
  const dateRange = rangeForPeriod(period, customRange);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <SourceOfTruthBadge variant={variant} />
          </div>
          {description ? <p className="text-sm text-muted-foreground max-w-2xl">{description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          {onRefresh ? (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          ) : null}
          {onExport ? (
            <Button variant="outline" size="sm" onClick={onExport}>
              Export
            </Button>
          ) : null}
          {onPrint ? (
            <Button variant="outline" size="sm" onClick={onPrint}>
              Print
            </Button>
          ) : null}
          {onEmail ? (
            <Button variant="outline" size="sm" onClick={onEmail}>
              Email
            </Button>
          ) : null}
          {filters && !onPeriodChange ? filters : null}
        </div>
      </div>

      {onPeriodChange ? (
        <div className="no-print grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 border rounded-lg bg-muted/20">
          <div>
            <Label className="text-xs">Period</Label>
            <Select value={period} onValueChange={(v) => onPeriodChange(v as ReportPeriod)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Today</SelectItem>
                <SelectItem value="weekly">This week</SelectItem>
                <SelectItem value="monthly">This month</SelectItem>
                <SelectItem value="yearly">This year</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && onCustomRangeChange ? (
            <>
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={customRange.from}
                  onChange={(e) => onCustomRangeChange({ ...customRange, from: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={customRange.to}
                  onChange={(e) => onCustomRangeChange({ ...customRange, to: e.target.value })}
                />
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground flex items-end pb-2 sm:col-span-2">
              {dateRange.from} → {dateRange.to}
            </div>
          )}
          {filters}
        </div>
      ) : null}

      {(openingLabel || closingLabel) && (
        <div className="flex flex-wrap gap-4 text-xs font-mono border-b pb-2">
          {openingLabel ? <span>{openingLabel}</span> : null}
          {closingLabel ? <span>{closingLabel}</span> : null}
        </div>
      )}

      {children}

      {footer ? <div className="text-xs text-muted-foreground border-t pt-2">{footer}</div> : null}
    </div>
  );
}
