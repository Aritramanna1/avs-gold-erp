import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
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
import { PassbookContent } from "./attendance.index";
import { Logo } from "@/components/ui/Logo";

export const Route = createFileRoute("/attendance/print/$kind/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || shopName.slice(0, 3).toUpperCase();
    return {
      meta: [{ title: `Print · ${shortName} ERP` }],
    };
  },
  component: PrintPage,
});

function PrintPage() {
  const params = Route.useParams();
  const id = params.id;
  // Accept hyphen aliases for canonical kinds (URLs like /gold-advance/ map to gold_advance)
  const KIND_ALIASES: Record<string, string> = {
    "gold-advance": "gold_advance",
    "wastage-return": "wastage_return",
  };
  const kind = KIND_ALIASES[params.kind] ?? params.kind;

  useEffect(() => {
    // give browser a tick to render before opening dialog
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>
      <div className="max-w-3xl mx-auto p-8">
        <div className="no-print mb-4 flex justify-between items-center">
          <Link to="/attendance" className="text-sm underline">
            ← Back to Attendance
          </Link>
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-4 py-1.5 rounded text-sm"
          >
            Print
          </button>
        </div>
        <Header kind={kind} />
        <Body kind={kind} id={id} />
        <Footer />
        <AvsPrintFooter />
      </div>
    </div>
  );
}

function Header({ kind }: { kind: string }) {
  const { firm } = useSettings();
  const shortName = firm.shopName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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
  return (
    <div className="border-b-2 border-black pb-3 mb-5">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Logo
            variant="png"
            className="h-12 w-12 object-contain flex-shrink-0 print:h-10 print:w-10"
          />
          <div>
            <div className="text-2xl font-serif">{firm.shopName}</div>
            <div className="text-xs text-gray-600">{shortName} ERP · Worker Document</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-medium">{titles[kind] ?? "Document"}</div>
          <div className="text-xs text-gray-600">Printed {todayISO()}</div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const { firm } = useSettings();
  return (
    <div className="mt-12 pt-4 border-t border-gray-400 text-xs text-gray-600 grid grid-cols-2 gap-8">
      <div>
        <div className="h-12" />
        <div className="border-t border-gray-500 pt-1">
          {firm.signatureLabelLeft || "Worker signature / thumb"}
        </div>
      </div>
      <div>
        <div className="h-12" />
        <div className="border-t border-gray-500 pt-1">
          {firm?.signatureLabelRight || "Authorised Signatory"}
        </div>
      </div>
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
