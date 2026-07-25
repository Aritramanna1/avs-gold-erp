import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import {
  useWorkers,
  ATTENDANCE_LABELS,
  PAY_MODE_LABELS,
  paiseToRupees,
  summarizeAttendance,
  monthKey,
  todayISO,
} from "@/lib/workers-store";
import { mgToGrams } from "@/lib/gold";
import { shortShopName } from "@/lib/app-info";
import { PassbookContent } from "./attendance.index";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";
import type { PrintDocType } from "@/lib/printlog-store";
import { buildWorkerPassbookRows } from "@/lib/workers-store";
import {
  generateReportPdf,
  generateWorkerSlipPdf,
  generateAttendanceSheetPdf,
  type WorkerSlipSection,
} from "@/lib/pdf/document-pdf-generator";
import { toast } from "sonner";

export const Route = createFileRoute("/attendance/print/$kind/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Print · ${shortName} ERP` }],
    };
  },
  component: PrintPage,
});

const titles: Record<string, string> = {
  passbook: "Worker Passbook",
  settlement: "Home-Going Final Settlement Slip",
  withdrawal: "Withdrawal Slip",
  loan: "Loan Slip",
  advance: "Salary Advance Slip",
  gold_advance: "Gold Advance Slip",
  wastage_return: "Wastage Gold Return Receipt",
  attendance: "Attendance Sheet",
};

// ponytail: "advance" (salary advance) has no dedicated PrintDocType in printlog-store —
// it shares the exact same shape (amountPaise + mode) as "withdrawal" in Body() below,
// so it reuses withdrawal_slip rather than inventing a new doc type.
const docTypeMap: Record<string, PrintDocType> = {
  passbook: "worker_passbook",
  settlement: "home_settlement_slip",
  withdrawal: "withdrawal_slip",
  loan: "loan_slip",
  advance: "withdrawal_slip",
  gold_advance: "gold_advance_slip",
  wastage_return: "wastage_return_receipt",
  attendance: "attendance_sheet",
};

function PrintPage() {
  const params = Route.useParams();
  const id = params.id;
  // Accept hyphen aliases for canonical kinds (URLs like /gold-advance/ map to gold_advance)
  const KIND_ALIASES: Record<string, string> = {
    "gold-advance": "gold_advance",
    "wastage-return": "wastage_return",
  };
  const kind = KIND_ALIASES[params.kind] ?? params.kind;

  const people = usePeople((s) => s.people);
  const withdrawals = useWorkers((s) => s.withdrawals);
  const loans = useWorkers((s) => s.loans);
  const advances = useWorkers((s) => s.advances);
  const goldAdvances = useWorkers((s) => s.goldAdvances);
  const wastageReturns = useWorkers((s) => s.wastageReturns);
  const settlements = useWorkers((s) => s.settlements);
  const attendance = useWorkers((s) => s.attendance);

  const recordExists = (() => {
    switch (kind) {
      case "passbook":
      case "attendance":
        return !!people.find((p) => p.id === id);
      case "withdrawal":
        return !!withdrawals.find((w) => w.id === id);
      case "advance":
        return !!advances.find((a) => a.id === id);
      case "loan":
        return !!loans.find((l) => l.id === id);
      case "gold_advance":
        return !!goldAdvances.find((g) => g.id === id);
      case "wastage_return":
        return !!wastageReturns.find((w) => w.id === id);
      case "settlement":
        return !!settlements.find((s) => s.id === id);
      default:
        return false;
    }
  })();

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(recordExists ? (docTypeMap[kind] ?? null) : null, id);
  const firm = useSettings((s) => s.firm);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const title = titles[kind] ?? "Document";

  // Every branch here reads the exact same store data/fields that Body()
  // renders on screen for that kind (see the switch below it) -- kept as
  // one download handler instead of duplicating the field mapping a second
  // time per kind.
  async function handleDownloadPdf() {
    if (!recordExists) return;
    setDownloadingPdf(true);
    try {
      if (kind === "passbook") {
        const worker = people.find((p) => p.id === id)!;
        const rows = buildWorkerPassbookRows(id, {
          withdrawals,
          loans,
          advances,
          goldAdvances,
          wastageReturns,
          settlements,
        });
        let cashBal = 0;
        let goldBal = 0;
        const blob = generateReportPdf(
          {
            title: `Worker Passbook — ${worker.fullName}`,
            reportNo: worker.id,
            columns: [
              { header: "Date", key: "date", width: 20 },
              { header: "Event", key: "label", width: 35 },
              { header: "Cash Out", key: "cashOut", width: 20, align: "right" },
              { header: "Cash In", key: "cashIn", width: 20, align: "right" },
              { header: "Cash Bal", key: "cashBal", width: 20, align: "right" },
              { header: "Gold Out (g)", key: "goldOut", width: 20, align: "right" },
              { header: "Gold In (g)", key: "goldIn", width: 20, align: "right" },
              { header: "Note", key: "note", width: 35 },
            ],
            rows: rows.map((r) => {
              cashBal += (r.cashIn ?? 0) - (r.cashOut ?? 0);
              goldBal += (r.goldIn ?? 0) - (r.goldOut ?? 0);
              return {
                date: r.date,
                label: r.label,
                cashOut: r.cashOut ? (r.cashOut / 100).toFixed(2) : "",
                cashIn: r.cashIn ? (r.cashIn / 100).toFixed(2) : "",
                cashBal: (cashBal / 100).toFixed(2),
                goldOut: r.goldOut ? (r.goldOut / 1000).toFixed(3) : "",
                goldIn: r.goldIn ? (r.goldIn / 1000).toFixed(3) : "",
                note: r.note ?? "",
              };
            }),
          },
          firm,
        );
        downloadBlob(blob, `Passbook-${worker.fullName.replace(/\s+/g, "-")}.pdf`);
        return;
      }

      if (kind === "attendance") {
        const worker = people.find((p) => p.id === id)!;
        const month = monthKey(todayISO());
        const list = attendance
          .filter((a) => a.workerId === worker.id && a.date.startsWith(month))
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        const s = summarizeAttendance(attendance, {
          workerId: worker.id,
          fromDate: `${month}-01`,
          toDate: `${month}-31`,
        });
        const blob = generateAttendanceSheetPdf(
          {
            personName: worker.fullName,
            personRole: worker.workType ?? "Karigar / Worker",
            personPhone: worker.phone,
            month,
            rows: list.map((e) => ({
              date: e.date,
              status: ATTENDANCE_LABELS[e.status],
              overtime: e.overtimeHours ? String(e.overtimeHours) : "",
              notes: e.notes ?? "",
            })),
            summary: {
              present: s.present,
              halfDay: s.halfDay,
              absent: s.absent,
              payable: s.payable,
            },
          },
          firm,
        );
        downloadBlob(blob, `Attendance-${worker.fullName.replace(/\s+/g, "-")}-${month}.pdf`);
        return;
      }

      if (kind === "withdrawal" || kind === "advance") {
        const item =
          kind === "withdrawal"
            ? withdrawals.find((w) => w.id === id)
            : advances.find((a) => a.id === id);
        if (!item) return;
        const worker = people.find((p) => p.id === item.workerId);
        const blob = generateWorkerSlipPdf(
          {
            title: kind === "withdrawal" ? "Withdrawal Slip" : "Salary Advance Slip",
            docNo: docNumber || item.id,
            date: item.date,
            personName: worker?.fullName ?? "—",
            personRole: worker?.workType,
            personPhone: worker?.phone,
            sections: [
              {
                rows: [
                  ["Date", item.date],
                  ["Amount", `Rs ${paiseToRupees(item.amountPaise)}`],
                  ["Mode", PAY_MODE_LABELS[item.mode]],
                ],
              },
            ],
            notes: item.notes,
          },
          firm,
        );
        downloadBlob(blob, `${kind === "withdrawal" ? "Withdrawal" : "Advance"}-${item.id}.pdf`);
        return;
      }

      if (kind === "loan") {
        const item = loans.find((l) => l.id === id);
        if (!item) return;
        const worker = people.find((p) => p.id === item.workerId);
        const blob = generateWorkerSlipPdf(
          {
            title: "Loan Slip",
            docNo: docNumber || item.id,
            date: item.date,
            personName: worker?.fullName ?? "—",
            personRole: worker?.workType,
            personPhone: worker?.phone,
            sections: [
              {
                rows: [
                  ["Date", item.date],
                  ["Loan amount", `Rs ${paiseToRupees(item.amountPaise)}`],
                  ["Reason", item.reason ?? "—"],
                ],
              },
            ],
            notes: item.notes,
          },
          firm,
        );
        downloadBlob(blob, `Loan-${item.id}.pdf`);
        return;
      }

      if (kind === "gold_advance" || kind === "wastage_return") {
        const item =
          kind === "gold_advance"
            ? goldAdvances.find((g) => g.id === id)
            : wastageReturns.find((w) => w.id === id);
        if (!item) return;
        const worker = people.find((p) => p.id === item.workerId);
        const blob = generateWorkerSlipPdf(
          {
            title: kind === "gold_advance" ? "Gold Advance Slip" : "Wastage Gold Return Receipt",
            docNo: docNumber || item.id,
            date: item.date,
            personName: worker?.fullName ?? "—",
            personRole: worker?.workType,
            personPhone: worker?.phone,
            sections: [
              {
                rows: [
                  ["Date", item.date],
                  ["Gross weight", `${mgToGrams(item.grossMg)} g`],
                  ["Purity / touch", String(item.purity)],
                  ["Fine gold", `${mgToGrams(item.fineMg)} g`],
                ],
              },
            ],
            notes: item.notes,
          },
          firm,
        );
        downloadBlob(
          blob,
          `${kind === "gold_advance" ? "GoldAdvance" : "WastageReturn"}-${item.id}.pdf`,
        );
        return;
      }

      if (kind === "settlement") {
        const s = settlements.find((x) => x.id === id);
        if (!s) return;
        const worker = people.find((p) => p.id === s.workerId);
        const sections: WorkerSlipSection[] = [
          {
            heading: "Period",
            rows: [
              ["Period", `${s.fromDate} to ${s.toDate}`],
              ["Present days", String(s.presentDays)],
              ["Half-days", String(s.halfDays)],
              ["Absent days", String(s.absentDays)],
              ["Leave days", String(s.leaveDays)],
              ["Payable days", String(s.payableDays)],
            ],
          },
          {
            heading: "Cash Side",
            rows: [
              ["Salary earned", `Rs ${paiseToRupees(s.salaryEarnedPaise)}`],
              ["Less: Withdrawals", `Rs ${paiseToRupees(s.withdrawalsTotalPaise)}`],
              ["Less: Salary advances applied", `Rs ${paiseToRupees(s.advanceDeductionPaise)}`],
              ["Less: Loan deducted", `Rs ${paiseToRupees(s.loanDeductionPaise)}`],
              ["Final cash payable", `Rs ${paiseToRupees(s.finalCashPayablePaise)}`],
            ],
          },
          {
            heading: "Gold Side",
            rows: [
              ["Gold advance (fine)", `${mgToGrams(s.goldAdvanceFineMg)} g`],
              ["Less: Wastage returned (fine)", `${mgToGrams(s.wastageReturnedFineMg)} g`],
              [
                "Net gold",
                s.netGoldMg === 0
                  ? "Settled"
                  : s.netGoldMg > 0
                    ? `Worker owes ${mgToGrams(s.netGoldMg)} g`
                    : `Shop holds ${mgToGrams(-s.netGoldMg)} g credit`,
              ],
            ],
          },
        ];
        const blob = generateWorkerSlipPdf(
          {
            title: "Home-Going Final Settlement Slip",
            docNo: docNumber || s.id,
            date: s.toDate,
            personName: worker?.fullName ?? "—",
            personRole: worker?.workType,
            personPhone: worker?.phone,
            sections,
            notes: s.notes,
          },
          firm,
        );
        downloadBlob(blob, `Settlement-${s.id}.pdf`);
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title={title}
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl="/attendance"
        onDownloadPdf={recordExists ? handleDownloadPdf : undefined}
        downloadingPdf={downloadingPdf}
      />

      <AutoPrint trigger={recordExists ? handlePrintTrigger : undefined} />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title={title}
          docNumber={docNumber}
          docType={docTypeMap[kind]}
          recordId={id}
          createdAt={Date.now()}
          size="a4"
        >
          <Body kind={kind} id={id} />

          {/* Signatures */}
          <div className="mt-12 pt-4 border-t border-gray-400 text-xs text-gray-600 grid grid-cols-2 gap-8">
            <SignatureBlock side="left" />
            <SignatureBlock side="right" />
          </div>
        </PrintLayout>
      </div>
    </div>
  );
}

// Fires window.print() ~400ms after mount, same intentional auto-print-on-load UX
// as before this migration — workers expect the slip to print immediately.
// Routed through handlePrintTrigger (not a bare window.print()) so the print
// gets logged in the print registry, same as a manual toolbar click would.
function AutoPrint({ trigger }: { trigger?: () => void }) {
  useEffect(() => {
    if (!trigger) return;
    const t = setTimeout(() => {
      try {
        trigger();
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [trigger]);
  return null;
}

function SignatureBlock({ side }: { side: "left" | "right" }) {
  const { firm } = useSettings();
  const label =
    side === "left"
      ? firm.signatureLabelLeft || "Worker signature / thumb"
      : firm?.signatureLabelRight || "Authorised Signatory";
  return (
    <div className={side === "right" ? "text-right" : ""}>
      <div className="h-12" />
      <div className="border-t border-gray-500 pt-1">{label}</div>
    </div>
  );
}

function Body({ kind, id }: { kind: string; id: string }) {
  const people = usePeople((s) => s.people);
  const withdrawals = useWorkers((s) => s.withdrawals);
  const loans = useWorkers((s) => s.loans);
  const advances = useWorkers((s) => s.advances);
  const goldAdvances = useWorkers((s) => s.goldAdvances);
  const wastageReturns = useWorkers((s) => s.wastageReturns);
  const settlements = useWorkers((s) => s.settlements);
  const attendance = useWorkers((s) => s.attendance);

  if (kind === "passbook" || kind === "attendance") {
    const worker = people.find((p) => p.id === id);
    if (!worker) return <NotFound />;
    if (kind === "passbook") {
      return (
        <div>
          <PersonBlock
            name={worker.fullName}
            role={worker.workType ?? "Karigar / Worker"}
            phone={worker.phone}
          />
          <PassbookContent workerId={worker.id} />
        </div>
      );
    }
    // attendance sheet
    const month = monthKey(todayISO());
    const list = attendance
      .filter((a) => a.workerId === worker.id && a.date.startsWith(month))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const s = summarizeAttendance(attendance, {
      workerId: worker.id,
      fromDate: `${month}-01`,
      toDate: `${month}-31`,
    });
    return (
      <div>
        <PersonBlock
          name={worker.fullName}
          role={worker.workType ?? "Karigar / Worker"}
          phone={worker.phone}
        />
        <div className="mb-3 text-sm">
          Month: <b>{month}</b>
        </div>
        <table className="w-full text-sm border border-gray-400">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border border-gray-300 text-left">Date</th>
              <th className="p-2 border border-gray-300 text-left">Status</th>
              <th className="p-2 border border-gray-300 text-left">OT</th>
              <th className="p-2 border border-gray-300 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td className="p-2 border border-gray-300">{e.date}</td>
                <td className="p-2 border border-gray-300">{ATTENDANCE_LABELS[e.status]}</td>
                <td className="p-2 border border-gray-300">{e.overtimeHours ?? ""}</td>
                <td className="p-2 border border-gray-300">{e.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
          <Cell label="Present" value={String(s.present)} />
          <Cell label="Half-day" value={String(s.halfDay)} />
          <Cell label="Absent" value={String(s.absent)} />
          <Cell label="Payable" value={String(s.payable)} />
        </div>
      </div>
    );
  }

  if (kind === "withdrawal" || kind === "advance") {
    const item =
      kind === "withdrawal"
        ? withdrawals.find((w) => w.id === id)
        : advances.find((a) => a.id === id);
    if (!item) return <NotFound />;
    const worker = people.find((p) => p.id === item.workerId);
    return (
      <div>
        <PersonBlock
          name={worker?.fullName ?? "—"}
          role={worker?.workType ?? ""}
          phone={worker?.phone ?? ""}
        />
        <KeyVal
          data={[
            ["Date", item.date],
            ["Amount", paiseToRupees(item.amountPaise)],
            ["Mode", PAY_MODE_LABELS[item.mode]],
            ["Notes", item.notes ?? "—"],
          ]}
        />
      </div>
    );
  }

  if (kind === "loan") {
    const item = loans.find((l) => l.id === id);
    if (!item) return <NotFound />;
    const worker = people.find((p) => p.id === item.workerId);
    return (
      <div>
        <PersonBlock
          name={worker?.fullName ?? "—"}
          role={worker?.workType ?? ""}
          phone={worker?.phone ?? ""}
        />
        <KeyVal
          data={[
            ["Date", item.date],
            ["Loan amount", paiseToRupees(item.amountPaise)],
            ["Reason", item.reason ?? "—"],
            ["Notes", item.notes ?? "—"],
          ]}
        />
        <p className="mt-4 text-sm">
          Loan will be deducted from final salary settlement. Any remaining balance is carried
          forward.
        </p>
      </div>
    );
  }

  if (kind === "gold_advance" || kind === "wastage_return") {
    const item =
      kind === "gold_advance"
        ? goldAdvances.find((g) => g.id === id)
        : wastageReturns.find((w) => w.id === id);
    if (!item) return <NotFound />;
    const worker = people.find((p) => p.id === item.workerId);
    return (
      <div>
        <PersonBlock
          name={worker?.fullName ?? "—"}
          role={worker?.workType ?? ""}
          phone={worker?.phone ?? ""}
        />
        <KeyVal
          data={[
            ["Date", item.date],
            ["Gross weight", `${mgToGrams(item.grossMg)} g`],
            ["Purity / touch", String(item.purity)],
            ["Fine gold", `${mgToGrams(item.fineMg)} g`],
            ["Notes", item.notes ?? "—"],
          ]}
        />
      </div>
    );
  }

  if (kind === "settlement") {
    const s = settlements.find((x) => x.id === id);
    if (!s) return <NotFound />;
    const worker = people.find((p) => p.id === s.workerId);
    return (
      <div>
        <PersonBlock
          name={worker?.fullName ?? "—"}
          role={worker?.workType ?? ""}
          phone={worker?.phone ?? ""}
        />
        <KeyVal
          data={[
            ["Period", `${s.fromDate} → ${s.toDate}`],
            ["Present days", String(s.presentDays)],
            ["Half-days", String(s.halfDays)],
            ["Absent days", String(s.absentDays)],
            ["Leave days", String(s.leaveDays)],
            ["Payable days", String(s.payableDays)],
          ]}
        />
        <h3 className="mt-5 mb-2 font-medium">Cash Side</h3>
        <KeyVal
          data={[
            ["Salary earned", paiseToRupees(s.salaryEarnedPaise)],
            ["Less: Withdrawals", paiseToRupees(s.withdrawalsTotalPaise)],
            ["Less: Salary advances applied", paiseToRupees(s.advanceDeductionPaise)],
            ["Less: Loan deducted", paiseToRupees(s.loanDeductionPaise)],
            ["Final cash payable", paiseToRupees(s.finalCashPayablePaise)],
          ]}
        />
        <h3 className="mt-5 mb-2 font-medium">Gold Side</h3>
        <KeyVal
          data={[
            ["Gold advance (fine)", `${mgToGrams(s.goldAdvanceFineMg)} g`],
            ["Less: Wastage returned (fine)", `${mgToGrams(s.wastageReturnedFineMg)} g`],
            [
              "Net gold",
              s.netGoldMg === 0
                ? "Settled"
                : s.netGoldMg > 0
                  ? `Worker owes ${mgToGrams(s.netGoldMg)} g`
                  : `Shop holds ${mgToGrams(-s.netGoldMg)} g credit`,
            ],
          ]}
        />
        {s.notes && (
          <p className="mt-4 text-sm">
            <b>Notes:</b> {s.notes}
          </p>
        )}
      </div>
    );
  }

  return <NotFound />;
}

function PersonBlock({ name, role, phone }: { name: string; role: string; phone: string }) {
  return (
    <div className="border border-gray-400 rounded p-3 mb-5 grid grid-cols-3 text-sm">
      <div>
        <div className="text-xs text-gray-600">Worker</div>
        <div className="font-medium">{name}</div>
      </div>
      <div>
        <div className="text-xs text-gray-600">Role</div>
        <div>{role || "—"}</div>
      </div>
      <div>
        <div className="text-xs text-gray-600">Phone</div>
        <div>{phone || "—"}</div>
      </div>
    </div>
  );
}

function KeyVal({ data }: { data: [string, string][] }) {
  return (
    <table className="w-full text-sm border border-gray-400">
      <tbody>
        {data.map(([k, v]) => (
          <tr key={k}>
            <td className="p-2 border border-gray-300 w-1/2 bg-gray-50">{k}</td>
            <td className="p-2 border border-gray-300">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-400 rounded p-2">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}

function NotFound() {
  return <div className="text-center text-gray-500 py-12">Record not found.</div>;
}
