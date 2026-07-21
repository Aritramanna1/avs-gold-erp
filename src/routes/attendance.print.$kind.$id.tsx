import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
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

  const title = titles[kind] ?? "Document";

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
