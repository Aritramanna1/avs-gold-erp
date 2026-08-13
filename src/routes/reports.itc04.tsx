import { useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { computeITC04Records, exportITC04ToCSV } from "@/lib/itc04-store";
import { useOutsideWork } from "@/lib/outside-work-store";
import { usePeople } from "@/lib/people-store";

export const Route = createFileRoute("/reports/itc04")({
  component: ITC04ReportPage,
});

function ITC04ReportPage() {
  const transactions = useOutsideWork((s) => s.transactions);
  const refreshTransactions = useOutsideWork((s) => s.refresh);
  const people = usePeople((s) => s.people);

  useEffect(() => {
    void refreshTransactions();
  }, [refreshTransactions]);

  const records = useMemo(() => computeITC04Records(transactions, people), [transactions, people]);

  const handleExportCSV = () => {
    const csvContent = exportITC04ToCSV(records);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `ITC04_GST_JobWork_Register_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const overdueCount = records.filter((r) => r.isOverdueOneYear).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-600" />
            ITC-04 GST Job-Work Register
          </h1>
          <p className="text-sm text-slate-600">
            GST Section 143 Compliance Register for Raw Metal Issued & Returned by Job-Workers /
            Karigars.
          </p>
        </div>

        <Button
          onClick={handleExportCSV}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Download className="h-4 w-4" /> Export GST Portal CSV
        </Button>
      </div>

      {overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50 text-red-900">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold">
                ⚠️ {overdueCount} Job-Work Challan(s) Approaching 1-Year Threshold!
              </p>
              <p className="text-xs text-red-700">
                Under CGST Section 143, inputs sent to job-workers must be returned within 1 year.
                Otherwise, it is treated as a taxable supply from the original challan date.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
          <CardTitle className="text-sm font-semibold text-slate-700">
            Active ITC-04 Job Work Register Entries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile view */}
          <div className="block md:hidden divide-y divide-slate-200">
            {records.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs italic">
                No active entries.
              </div>
            ) : (
              records.map((r) => (
                <div key={r.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-slate-900">{r.workerName}</span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        Challan: {r.challanNo} ({r.challanDate})
                      </span>
                    </div>
                    {r.isOverdueOneYear ? (
                      <Badge className="bg-red-100 text-red-800 border-red-200 gap-1 text-[10px]">
                        <AlertTriangle className="h-3 w-3" /> Overdue
                      </Badge>
                    ) : r.status === "fully_returned" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-[10px]">
                        <CheckCircle className="h-3 w-3" /> Returned
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 text-[10px]">
                        <Clock className="h-3 w-3" /> In Progress
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-slate-50 p-2 rounded-lg text-center">
                    <div>
                      <span className="text-[9px] text-slate-500 block font-sans">Sent</span>
                      <span className="text-amber-700">
                        {(r.inputsSentFineMg / 1000).toFixed(3)}g
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-sans">Returned</span>
                      <span className="text-emerald-700">
                        {(r.goodsReturnedFineMg / 1000).toFixed(3)}g
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-sans">Days Held</span>
                      <span
                        className={r.isOverdueOneYear ? "text-red-600 font-bold" : "text-slate-700"}
                      >
                        {r.daysHeld}d
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    GSTIN: <span className="font-mono">{r.workerGstin || "URP"}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Challan No & Date</th>
                  <th className="p-3">Karigar / Worker</th>
                  <th className="p-3">GSTIN</th>
                  <th className="p-3 text-right">Sent (Fine g)</th>
                  <th className="p-3 text-right">Returned (Fine g)</th>
                  <th className="p-3 text-right">Days Held</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium">
                      <div>{r.challanNo}</div>
                      <div className="text-xs text-slate-500">{r.challanDate}</div>
                    </td>
                    <td className="p-3 font-medium text-slate-900">{r.workerName}</td>
                    <td className="p-3 text-xs font-mono text-slate-600">
                      {r.workerGstin || "URP"}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-amber-700">
                      {(r.inputsSentFineMg / 1000).toFixed(3)}g
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                      {(r.goodsReturnedFineMg / 1000).toFixed(3)}g
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span
                        className={r.isOverdueOneYear ? "text-red-600 font-bold" : "text-slate-700"}
                      >
                        {r.daysHeld} days
                      </span>
                    </td>
                    <td className="p-3">
                      {r.isOverdueOneYear ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
                          <AlertTriangle className="h-3 w-3" /> Overdue (&gt;300d)
                        </Badge>
                      ) : r.status === "fully_returned" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                          <CheckCircle className="h-3 w-3" /> Returned
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
                          <Clock className="h-3 w-3" /> In Progress
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
