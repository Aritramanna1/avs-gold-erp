import { Button } from "@/components/ui/button";
import { rangeForPeriod, type DateRange, type ReportPeriod } from "@/lib/report-engine";

const PERIODS: ReportPeriod[] = ["daily", "weekly", "monthly", "yearly"];

/**
 * Shared Daily/Weekly/Monthly/Yearly toggle for report pages — every report
 * that adopts this shares the same rangeForPeriod() boundaries (Monday-start
 * week, calendar month/year), so two reports can never disagree about what
 * "this week" or "this month" means.
 */
export function ReportPeriodToggle({
  period,
  range,
  onChange,
}: {
  period: ReportPeriod;
  range: DateRange;
  onChange: (period: ReportPeriod, range: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="report-period-toggle">
      {PERIODS.map((p) => (
        <Button
          key={p}
          size="sm"
          variant={period === p ? "default" : "outline"}
          onClick={() => onChange(p, rangeForPeriod(p, range))}
          data-testid={`period-${p}`}
        >
          {p[0].toUpperCase() + p.slice(1)}
        </Button>
      ))}
    </div>
  );
}
