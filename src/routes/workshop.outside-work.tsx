import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usePeople } from "@/lib/people-store";
import { useOutsideWork, computeOutsideWorkPosition } from "@/lib/outside-work-store";
import {
  useOutsideWorkLabour,
  computeOutsideWorkLabourPosition,
} from "@/lib/outside-work-labour-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/orders-store";
import { OutsideWorkIssueDialog } from "@/components/outside-work-issue-dialog";
import { OutsideWorkReceiveDialog } from "@/components/outside-work-receive-dialog";
import { OutsideWorkLabourDialog } from "@/components/outside-work-labour-dialog";
import { OutsideWorkPaymentDialog } from "@/components/outside-work-payment-dialog";
import { OutsideWorkSettlementDialog } from "@/components/outside-work-settlement-dialog";
import { OutsideWorkStatementDialog } from "@/components/outside-work-statement-dialog";
import {
  Truck,
  PackageCheck,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Scale,
  FileText,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/workshop/outside-work")({
  head: () => ({ meta: [{ title: "Outside Work · AVS Gold ERP" }] }),
  // Manufacturing Books freeze (Workshop V1 RC): Outside Work is deferred
  // pending a dedicated pass — see docs/CHANGELOG.md. OutsideWorkPage stays
  // in the repo untouched, just unreachable, so it renders again once this
  // is un-frozen.
  component: () => (
    <ModuleComingSoon
      title="Outside Work (Coming Soon)"
      message="Outside worker gold issue/return and labour tracking are deferred to a future manufacturing release."
      icon={Truck}
    />
  ),
});

export function OutsideWorkPage() {
  const people = usePeople((s) => s.people);
  const transactions = useOutsideWork((s) => s.transactions);
  const refreshOutsideWork = useOutsideWork((s) => s.refresh);
  const charges = useOutsideWorkLabour((s) => s.charges);
  const payments = useOutsideWorkLabour((s) => s.payments);
  const refreshLabour = useOutsideWorkLabour((s) => s.refresh);
  const approveCharge = useOutsideWorkLabour((s) => s.approveCharge);
  const settlements = useGoldSettlement((s) => s.settlements);
  const refreshSettlements = useGoldSettlement((s) => s.refresh);

  useEffect(() => {
    refreshOutsideWork();
    refreshLabour();
    refreshSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jewellers = useMemo(
    () => people.filter((p) => p.type === "outside_worker" || p.type === "vendor"),
    [people],
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [labourOpen, setLabourOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && jewellers.length > 0) setSelectedId(jewellers[0].id);
  }, [jewellers, selectedId]);

  const selectedJeweller = jewellers.find((j) => j.id === selectedId);

  const jewellerTxns = useMemo(
    () => transactions.filter((t) => t.jewellerId === selectedId).sort((a, b) => b.ts - a.ts),
    [transactions, selectedId],
  );
  const position = useMemo(() => computeOutsideWorkPosition(jewellerTxns), [jewellerTxns]);

  const jewellerCharges = useMemo(
    () => charges.filter((c) => c.jewellerId === selectedId).sort((a, b) => b.ts - a.ts),
    [charges, selectedId],
  );
  const jewellerPayments = useMemo(
    () => payments.filter((p) => p.jewellerId === selectedId).sort((a, b) => b.ts - a.ts),
    [payments, selectedId],
  );
  const labourPosition = useMemo(
    () => computeOutsideWorkLabourPosition(jewellerCharges, jewellerPayments),
    [jewellerCharges, jewellerPayments],
  );

  const jewellerSettlements = useMemo(
    () =>
      settlements
        .filter((s) => s.party_id === selectedId)
        .sort(
          (a, b) => new Date(b.settlement_date).getTime() - new Date(a.settlement_date).getTime(),
        ),
    [settlements, selectedId],
  );

  const overallPosition = useMemo(() => computeOutsideWorkPosition(transactions), [transactions]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Outside Work"
        subtitle="Gold, labour, billing and settlement for external jewellers (chain makers, ball makers, KDM suppliers)."
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              className="gap-2"
              onClick={() => setIssueOpen(true)}
              data-testid="outside-work-issue-btn"
            >
              <Truck className="h-4 w-4" /> Issue
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setReceiveOpen(true)}
              data-testid="outside-work-receive-btn"
            >
              <PackageCheck className="h-4 w-4" /> Receive
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setLabourOpen(true)}
              disabled={!selectedId}
              data-testid="outside-work-labour-btn"
            >
              <Receipt className="h-4 w-4" /> Labour Charge
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setPaymentOpen(true)}
              disabled={!selectedId}
              data-testid="outside-work-payment-btn"
            >
              <Wallet className="h-4 w-4" /> Payment
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setSettlementOpen(true)}
              disabled={!selectedId}
              data-testid="outside-work-settlement-btn"
            >
              <Scale className="h-4 w-4" /> Settlement
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setStatementOpen(true)}
              disabled={!selectedId}
              data-testid="outside-work-statement-btn"
            >
              <FileText className="h-4 w-4" /> Statement
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat
          label="Total Issued (fine)"
          value={`${mgToGrams(overallPosition.totalIssuedFineMg)} g`}
        />
        <Stat
          label="Total Returned (fine)"
          value={`${mgToGrams(overallPosition.totalReturnedFineMg)} g`}
        />
        <Stat
          label="Pending Gold"
          value={`${mgToGrams(overallPosition.pendingGoldFineMg)} g`}
          tone={overallPosition.pendingGoldFineMg > 0 ? "gold" : undefined}
        />
        <Stat
          label="Pending Material"
          value={`${mgToGrams(overallPosition.pendingMaterialGrossMg)} g`}
          tone={overallPosition.pendingMaterialGrossMg > 0 ? "gold" : undefined}
        />
      </div>

      {jewellers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">No outside jewellers yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a person with type "Outside Worker" or "Vendor" in People to start using this
            workflow.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger data-testid="outside-work-jeweller-filter">
                  <SelectValue placeholder="Select outside jeweller…" />
                </SelectTrigger>
                <SelectContent>
                  {jewellers.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
            <Stat label="Gold Issued" value={`${mgToGrams(position.totalIssuedFineMg)} g`} />
            <Stat label="Gold Returned" value={`${mgToGrams(position.totalReturnedFineMg)} g`} />
            <Stat
              label="Gold Outstanding"
              value={`${mgToGrams(position.pendingGoldFineMg)} g`}
              tone={position.pendingGoldFineMg > 0 ? "gold" : undefined}
            />
            <Stat
              label="Material Outstanding"
              value={`${mgToGrams(position.pendingMaterialGrossMg)} g`}
              tone={position.pendingMaterialGrossMg > 0 ? "gold" : undefined}
            />
            <Stat
              label="Last Transaction"
              value={
                position.lastTransactionTs
                  ? new Date(position.lastTransactionTs).toLocaleDateString("en-IN")
                  : "—"
              }
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat
              label="Labour Earned"
              value={`₹${paiseToRupees(labourPosition.totalBilledPaise)}`}
            />
            <Stat label="Labour Paid" value={`₹${paiseToRupees(labourPosition.totalPaidPaise)}`} />
            <Stat
              label="Labour Outstanding"
              value={`₹${paiseToRupees(labourPosition.outstandingPaise)}`}
              tone={labourPosition.outstandingPaise > 0 ? "gold" : undefined}
            />
            {labourPosition.advancePaise > 0 && (
              <Stat
                label="Labour Advance (credit)"
                value={`₹${paiseToRupees(labourPosition.advancePaise)}`}
              />
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-border font-serif text-gold">
              Transaction History
            </div>
            {jewellerTxns.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No transactions recorded yet for this jeweller.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {jewellerTxns.map((t) => (
                  <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {t.type === "issue" ? (
                        <ArrowUpRight className="h-4 w-4 text-amber-400 shrink-0" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4 text-emerald-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm">
                          {t.type === "issue" ? "Issued" : "Received"} · {t.materialType} ·{" "}
                          {mgToGrams(t.grossMg)} g
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {new Date(t.ts).toLocaleString("en-IN")}
                          {t.orderNo ? ` · Order ${t.orderNo}` : ""}
                          {t.expectedReturnDate ? ` · Expected back ${t.expectedReturnDate}` : ""}
                          {t.remarks ? ` · ${t.remarks}` : ""}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        t.type === "issue"
                          ? "border-amber-500/40 text-amber-300"
                          : "border-emerald-500/40 text-emerald-300"
                      }
                    >
                      {t.materialType === "Gold"
                        ? `${mgToGrams(t.fineMg)} g fine`
                        : `${mgToGrams(t.grossMg)} g`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-border font-serif text-gold">
              Labour Charges / Bills
            </div>
            {jewellerCharges.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No labour charges billed yet for this jeweller.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {jewellerCharges.map((c) => (
                  <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm">
                        {c.calculationMethod} · ₹{paiseToRupees(c.totalPaise)}
                        {c.gstEnabled ? ` (incl. GST ${c.gstRatePct}%)` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {new Date(c.ts).toLocaleString("en-IN")}
                        {c.billNumber ? ` · Bill ${c.billNumber}` : ""}
                        {c.billDate ? ` · ${c.billDate}` : ""}
                        {c.orderNo ? ` · Order ${c.orderNo}` : ""}
                        {c.remarks ? ` · ${c.remarks}` : ""}
                      </div>
                      {c.billAttachmentDataUrl && (
                        <a
                          href={c.billAttachmentDataUrl}
                          download={c.billAttachmentFileName || "bill-attachment"}
                          className="text-[11px] text-gold hover:underline"
                        >
                          View Attachment
                        </a>
                      )}
                    </div>
                    {c.approved ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 text-emerald-300 gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => approveCharge(c.id)}
                        data-testid={`outside-labour-approve-${c.id}`}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-border font-serif text-gold">Payments</div>
            {jewellerPayments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No payments recorded yet for this jeweller.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {jewellerPayments.map((p) => (
                  <li
                    key={p.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div>
                        ₹{paiseToRupees(p.amountPaise)} · {p.mode}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {new Date(p.ts).toLocaleString("en-IN")}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                        {p.orderNo ? ` · Order ${p.orderNo}` : ""}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-serif text-gold">
              Settlement History
            </div>
            {jewellerSettlements.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No settlements recorded yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {jewellerSettlements.map((s) => (
                  <li
                    key={s.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{new Date(s.settlement_date).toLocaleDateString("en-IN")}</span>
                    <span className="text-muted-foreground">
                      {s.settlement_type === "outside_work_gold_settlement"
                        ? "Gold Settlement"
                        : s.settlement_type === "outside_work_labour_settlement"
                          ? "Labour Settlement"
                          : s.settlement_type}
                    </span>
                    <span className="font-mono">
                      {s.settlement_type === "outside_work_gold_settlement"
                        ? `${mgToGrams(s.net_mg ?? 0)} g`
                        : `₹${paiseToRupees(s.amount_paise ?? 0)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* No explicit refresh() after add() — every store here already updates
          its own state optimistically inside add()/addPayment()/addCharge();
          re-running the local-first readAll() would race that optimistic
          update (see outside-work-store.ts's Repository.readAll() note). */}
      <OutsideWorkIssueDialog
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        defaultJewellerId={selectedId || undefined}
      />
      <OutsideWorkReceiveDialog
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        defaultJewellerId={selectedId || undefined}
      />
      {selectedJeweller && (
        <>
          <OutsideWorkLabourDialog
            open={labourOpen}
            onClose={() => setLabourOpen(false)}
            jewellerId={selectedJeweller.id}
            jewellerName={selectedJeweller.fullName}
          />
          <OutsideWorkPaymentDialog
            open={paymentOpen}
            onClose={() => setPaymentOpen(false)}
            jewellerId={selectedJeweller.id}
            jewellerName={selectedJeweller.fullName}
          />
          <OutsideWorkSettlementDialog
            open={settlementOpen}
            onClose={() => setSettlementOpen(false)}
            jewellerId={selectedJeweller.id}
            jewellerName={selectedJeweller.fullName}
          />
          <OutsideWorkStatementDialog
            open={statementOpen}
            onClose={() => setStatementOpen(false)}
            jewellerId={selectedJeweller.id}
            jewellerName={selectedJeweller.fullName}
          />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono ${tone === "gold" ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}
