import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJobCards, karigarCustodySummaries } from "@/lib/jobcards-store";
import { formatWeight } from "@/lib/gold";
import { ArrowLeft, Scale, Search, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/workshop/bench-custody")({
  head: () => ({ meta: [{ title: "Bench Custody · Manufacturing Books · AVS Gold ERP" }] }),
  component: BenchCustodyPage,
});

/** Ageing beyond this many days is flagged red — a job that's sat on a bench this long needs a look. */
const AGEING_ALERT_DAYS = 15;

/**
 * Workshop — Bench Custody.
 *
 * Answers the Manufacturing Ledger Master's core custody questions in one
 * table: who currently has our gold, how much, since when, and how much of
 * it is unaccounted overloss against the allowed wastage. Read-only — gold
 * is issued and returned through Worker Gold Book / job card receipts;
 * this is the reconciliation view over that same data.
 */
function BenchCustodyPage() {
  const jobs = useJobCards((s) => s.jobs);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summaries = useMemo(
    () => karigarCustodySummaries(jobs),

    [jobs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => s.karigarName.toLowerCase().includes(q));
  }, [summaries, query]);

  const totals = useMemo(
    () => ({
      outstandingMg: summaries.reduce((sum, s) => sum + s.outstandingMg, 0),
      overlossMg: summaries.reduce((sum, s) => sum + s.overlossMg, 0),
      karigars: summaries.filter((s) => s.outstandingMg > 0).length,
    }),
    [summaries],
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4">
        <Link
          to="/workshop"
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Workshop
        </Link>
      </div>

      <PageHeader
        title="Bench Custody"
        subtitle="Who currently has our gold, on which jobs, since when, and how much is overloss beyond the allowed wastage."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Totals k="Gold with karigars" v={formatWeight(totals.outstandingMg)} tone="gold" />
        <Totals
          k="Overloss"
          v={formatWeight(totals.overlossMg)}
          hint="Actual loss beyond allowed wastage on received work"
          tone={totals.overlossMg > 0 ? "red" : undefined}
        />
        <Totals k="Karigars holding gold" v={String(totals.karigars)} />
      </div>

      <div className="rounded-md border border-border bg-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search karigar by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            data-testid="bench-custody-search"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 p-12 text-center">
          <Scale className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">No custody to show</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A karigar shows up here once gold is issued to them in the Worker Gold Book.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="w-8" />
                <TableHead>Karigar</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Ageing</TableHead>
                <TableHead className="text-right">Overloss</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const expanded = expandedId === s.karigarId;
                const aged =
                  s.oldestIssueAgeDays !== undefined && s.oldestIssueAgeDays >= AGEING_ALERT_DAYS;
                const jobsWithOutstanding = s.jobs.filter((j) => j.outstandingMg > 0);
                return (
                  <>
                    <TableRow
                      key={s.karigarId}
                      className="h-8 cursor-pointer hover:bg-muted/20"
                      onClick={() => setExpandedId(expanded ? null : s.karigarId)}
                      data-testid="bench-custody-row"
                    >
                      <TableCell className="py-1.5">
                        {jobsWithOutstanding.length > 0 &&
                          (expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          ))}
                      </TableCell>
                      <TableCell className="py-1.5 font-medium">{s.karigarName}</TableCell>
                      <TableCell className="py-1.5 text-right font-mono">
                        {formatWeight(s.outstandingMg)}
                      </TableCell>
                      <TableCell
                        className={`py-1.5 text-right font-mono ${aged ? "text-red-300" : "text-muted-foreground"}`}
                      >
                        {s.oldestIssueAgeDays !== undefined ? `${s.oldestIssueAgeDays}d` : "—"}
                      </TableCell>
                      <TableCell
                        className={`py-1.5 text-right font-mono ${s.overlossMg > 0 ? "text-red-300" : "text-muted-foreground"}`}
                      >
                        {s.overlossMg > 0 ? formatWeight(s.overlossMg) : "—"}
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-muted-foreground">
                        {jobsWithOutstanding.length}
                      </TableCell>
                    </TableRow>
                    {expanded &&
                      jobsWithOutstanding.map((j) => (
                        <TableRow key={j.jobId} className="h-8 bg-muted/10">
                          <TableCell className="py-1.5" />
                          <TableCell className="py-1.5 pl-6 text-xs text-muted-foreground">
                            <Link
                              to="/workshop/job-card/$orderId"
                              params={{ orderId: j.jobId }}
                              className="hover:text-gold hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {j.jobNo}
                            </Link>
                          </TableCell>
                          <TableCell className="py-1.5 text-right font-mono text-xs">
                            {formatWeight(j.outstandingMg)}
                          </TableCell>
                          <TableCell className="py-1.5" colSpan={3} />
                        </TableRow>
                      ))}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Outstanding gold is derived from Worker Gold Book issues and returns linked to each job.
        Overloss is the excess of actual loss over allowed wastage recorded at work receipt.
      </p>
    </div>
  );
}

function Totals({
  k,
  v,
  hint,
  tone,
}: {
  k: string;
  v: string;
  hint?: string;
  tone?: "gold" | "red";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Scale className="h-3 w-3" /> {k}
      </div>
      <div
        className={`mt-1 font-mono text-lg ${tone === "gold" ? "text-gold" : tone === "red" ? "text-red-300" : ""}`}
      >
        {v}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
