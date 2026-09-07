const accountBalanceReportTemplate = builtin({
  id: "default_account_balance_report",
  docType: "account_balance_report",
  name: "Account Balance (Offline layout)",
  family: "dense_ledger",
  paperSize: "a4",
  sections: [
    { type: "header", id: "header", showQr: false },
    {
      type: "fieldGrid",
      id: "meta",
      columns: 2,
      fields: [
        { label: "Report", valuePath: "reportTitle", emphasis: true },
        { label: "As of", valuePath: "asOfLabel" },
      ],
    },
    {
      type: "table",
      id: "items",
      rowsPath: "items",
      footerRowPath: "itemsTotals",
      tableStyle: "classic",
      columns: [
        { key: "no", header: "No", align: "left", width: 0.45 },
        { key: "name", header: "Name", align: "left", width: 2.4 },
        { key: "phone", header: "Phone", align: "left", width: 1.2 },
        { key: "jamaWt", header: "Jama Wt", align: "right", width: 0.9 },
        { key: "returnWt", header: "Return Wt", align: "right", width: 0.9 },
        { key: "naveWt", header: "Nave Wt", align: "right", width: 0.9 },
        { key: "cash", header: "Cash", align: "right", width: 0.85 },
        { key: "anamat", header: "Anamat", align: "right", width: 0.85 },
        { key: "fine", header: "Fine", align: "right", width: 0.9 },
      ],
    },
  ],
});

const orderSlipTemplate = builtin({
  id: "default_order_slip",
  docType: "order_slip",
  name: "Work Order Slip (A4 / A5)",
  family: "classic_business",
  paperSize: "a4",
  sections: [
    standardHeader,
    partyCustomer,
    {
      type: "table",
      id: "items",
      title: "Order Items Schedule",
      rowsPath: "items",
      showFooterSums: true,
      columns: [
        { key: "description", header: "Description", align: "left", width: 3 },
        { key: "grossWt", header: "Gross (g)", align: "right" },
        { key: "netWt", header: "Net Wt (g)", align: "right" },
        { key: "purity", header: "Touch / Karat", align: "right" },
        { key: "fine", header: "Fine Gold", align: "right", footerSum: true },
        { key: "amount", header: "Estimated Amount â‚¹", align: "right", footerSum: true },
      ],
    },
    {
      type: "balanceCard",
      id: "balances",
      title: "Customer Account Balance",
      goldKey: "gold",
      cashKey: "cash",
      labelMode: "jama_naam",
    },
    {
      type: "richText",
      id: "notes",
      title: "Custom Design Notes",
      textPath: "notes",
      showIf: "hasNotes",
    },
    standardSignatures,
  ],
});

const estimateTemplate = builtin({
  id: "default_estimate_doc",
});
