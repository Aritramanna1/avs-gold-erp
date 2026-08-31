/**
 * AVS Gold ERP — ITC-04 GST Job-Work Register & Tax Compliance Engine
 * Tracks raw materials sent to Karigars/Job-Workers under Section 143 of CGST Act.
 */

export interface ITC04Record {
  id: string;
  challanNo: string;
  challanDate: string; // YYYY-MM-DD
  workerId: string;
  workerName: string;
  workerGstin?: string;
  workerStateCode?: string;

  inputsSentGrossMg: number;
  inputsSentFineMg: number;
  descriptionOfInputs: string;

  goodsReturnedGrossMg: number;
  goodsReturnedFineMg: number;
  scrapReturnedMg: number;
  lossMg: number;

  daysHeld: number;
  isOverdueOneYear: boolean; // > 300 days threshold alert
  status: "pending_return" | "partially_returned" | "fully_returned";
}

/**
 * Real ITC-04 register — one row per "issue" transaction to an outside
 * job-worker, matched against every "receive" transaction for the same
 * worker+material+purity that followed it (oldest issue consumed first).
 * Section 143's clock runs from the issue date, so days-held/overdue is
 * computed per issue challan, not on an aggregate position.
 */
export function computeITC04Records(
  transactions: Array<{
    id: string;
    txnNo: string;
    ts: number;
    type: "issue" | "receive";
    jewellerId: string;
    jewellerName: string;
    materialType: string;
    purity: number;
    grossMg: number;
    fineMg: number;
  }>,
  workers: Array<{ id: string; gstin?: string }>,
): ITC04Record[] {
  const gstinByWorker = new Map(workers.map((w) => [w.id, w.gstin]));
  const sorted = [...transactions].sort((a, b) => a.ts - b.ts);

  type OpenIssue = {
    txn: (typeof transactions)[number];
    remainingGrossMg: number;
    remainingFineMg: number;
    returnedGrossMg: number;
    returnedFineMg: number;
  };
  // FIFO queue per worker+material+purity — oldest issue is settled first by any receive.
  const openIssues = new Map<string, OpenIssue[]>();
  const key = (t: { jewellerId: string; materialType: string; purity: number }) =>
    `${t.jewellerId}::${t.materialType}::${t.purity}`;

  for (const txn of sorted) {
    const k = key(txn);
    if (txn.type === "issue") {
      const queue = openIssues.get(k) ?? [];
      queue.push({
        txn,
        remainingGrossMg: txn.grossMg,
        remainingFineMg: txn.fineMg,
        returnedGrossMg: 0,
        returnedFineMg: 0,
      });
      openIssues.set(k, queue);
    } else {
      const queue = openIssues.get(k);
      if (!queue || queue.length === 0) continue; // a receive with no matching issue on record
      let remainingToApplyGross = txn.grossMg;
      let remainingToApplyFine = txn.fineMg;
      for (const open of queue) {
        if (remainingToApplyGross <= 0) break;
        const applyGross = Math.min(open.remainingGrossMg, remainingToApplyGross);
        const applyFine = Math.min(open.remainingFineMg, remainingToApplyFine);
        open.remainingGrossMg -= applyGross;
        open.remainingFineMg -= applyFine;
        open.returnedGrossMg += applyGross;
        open.returnedFineMg += applyFine;
        remainingToApplyGross -= applyGross;
        remainingToApplyFine -= applyFine;
      }
    }
  }

  const now = Date.now();
  const DAY_MS = 86_400_000;
  const records: ITC04Record[] = [];
  for (const queue of openIssues.values()) {
    for (const open of queue) {
      const daysHeld = Math.floor((now - open.txn.ts) / DAY_MS);
      // Loss/scrap = sent minus returned — only meaningful once fully closed
      // out (still-outstanding material isn't lost, it just hasn't come back yet).
      const stillOutstanding = open.remainingGrossMg > 0;
      const status: ITC04Record["status"] = stillOutstanding
        ? open.returnedGrossMg > 0
          ? "partially_returned"
          : "pending_return"
        : "fully_returned";
      const gstin = gstinByWorker.get(open.txn.jewellerId);
      records.push({
        id: open.txn.id,
        challanNo: open.txn.txnNo,
        challanDate: new Date(open.txn.ts).toISOString().slice(0, 10),
        workerId: open.txn.jewellerId,
        workerName: open.txn.jewellerName,
        workerGstin: gstin,
        workerStateCode: gstin ? gstin.slice(0, 2) : undefined,
        inputsSentGrossMg: open.txn.grossMg,
        inputsSentFineMg: open.txn.fineMg,
        descriptionOfInputs: `${open.txn.materialType}${open.txn.purity ? ` (${open.txn.purity}‰)` : ""}`,
        goodsReturnedGrossMg: open.returnedGrossMg,
        goodsReturnedFineMg: open.returnedFineMg,
        scrapReturnedMg: 0,
        lossMg:
          status === "fully_returned" ? Math.max(0, open.txn.grossMg - open.returnedGrossMg) : 0,
        daysHeld,
        isOverdueOneYear: daysHeld > 300,
        status,
      });
    }
  }
  return records.sort((a, b) => b.daysHeld - a.daysHeld);
}

/**
 * Export ITC-04 records to GST Portal compliant CSV string.
 */
export function exportITC04ToCSV(records: ITC04Record[]): string {
  const headers = [
    "GSTIN of Job Worker",
    "State Code",
    "Challan Number",
    "Challan Date",
    "Description of Goods",
    "Quantity Sent (Grams)",
    "Fine Weight Sent (Grams)",
    "Quantity Returned (Grams)",
    "Loss/Scrap (Grams)",
    "Days Held",
    "Status",
  ];

  const rows = records.map((r) => [
    r.workerGstin || "URP (Unregistered)",
    r.workerStateCode || "19",
    r.challanNo,
    r.challanDate,
    `"${r.descriptionOfInputs.replace(/"/g, '""')}"`,
    (r.inputsSentGrossMg / 1000).toFixed(3),
    (r.inputsSentFineMg / 1000).toFixed(3),
    (r.goodsReturnedGrossMg / 1000).toFixed(3),
    (r.lossMg / 1000).toFixed(3),
    r.daysHeld,
    r.status,
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
