/**
 * AVS / ORNEXA ERP — ITC-04 GST Job-Work Register & Tax Compliance Engine
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

export function generateSampleITC04Records(): ITC04Record[] {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];

  return [
    {
      id: "itc-1",
      challanNo: "JW-2026-001",
      challanDate: dateStr,
      workerId: "w-101",
      workerName: "Raju Artisans Workshop",
      workerGstin: "19AAACR1234F1Z5",
      workerStateCode: "19",
      inputsSentGrossMg: 100000,
      inputsSentFineMg: 91600,
      descriptionOfInputs: "22K Gold Bullion Bars for Casting",
      goodsReturnedGrossMg: 80000,
      goodsReturnedFineMg: 73280,
      scrapReturnedMg: 15000,
      lossMg: 5000,
      daysHeld: 45,
      isOverdueOneYear: false,
      status: "partially_returned"
    },
    {
      id: "itc-2",
      challanNo: "JW-2025-089",
      challanDate: "2025-05-10",
      workerId: "w-102",
      workerName: "Bengal Ornaments Pvt Ltd",
      workerGstin: "19AABCB5678G2Z1",
      workerStateCode: "19",
      inputsSentGrossMg: 250000,
      inputsSentFineMg: 229000,
      descriptionOfInputs: "18K Gold Wire & Sheet",
      goodsReturnedGrossMg: 0,
      goodsReturnedFineMg: 0,
      scrapReturnedMg: 0,
      lossMg: 0,
      daysHeld: 320,
      isOverdueOneYear: true, // Over 300 days threshold!
      status: "pending_return"
    }
  ];
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
    "Status"
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
    r.status
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
