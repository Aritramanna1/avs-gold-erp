/** Module taxonomy matching 02_ERP_AUDIT_REPORT_SPEC.md workflow scope. */

export interface AuditModuleDef {
  id: string;
  label: string;
  group: string;
}

export const ERP_AUDIT_MODULES: AuditModuleDef[] = [
  { id: "people", label: "People / Party master", group: "Masters" },
  { id: "gold_material", label: "Gold / material books", group: "Books" },
  { id: "karigar", label: "Karigar transactions", group: "Workshop" },
  { id: "outside_work", label: "Outside work", group: "Workshop" },
  { id: "polishing", label: "Polishing", group: "Workshop" },
  { id: "meena", label: "Meena", group: "Workshop" },
  { id: "manufacturing", label: "Manufacturing", group: "Manufacturing" },
  { id: "stock", label: "Stock / ready stock", group: "Inventory" },
  { id: "diamonds", label: "Diamonds", group: "Inventory" },
  { id: "billing", label: "Billing", group: "Commercial" },
  { id: "purchases", label: "Purchases", group: "Commercial" },
  { id: "expenses", label: "Expenses", group: "Commercial" },
  { id: "receipts_payments", label: "Receipts / payments", group: "Commercial" },
  { id: "reports", label: "Reports hub", group: "Reports" },
  { id: "documents", label: "Documents / print", group: "Documents" },
  { id: "customer_portal", label: "Customer portal", group: "Portals" },
  { id: "supplier_portal", label: "Supplier portal", group: "Portals" },
  { id: "karigar_portal", label: "Karigar portal", group: "Portals" },
  { id: "platform_admin", label: "Platform / SaaS admin", group: "Platform" },
  { id: "calculations", label: "Fine-gold calculations", group: "Integrity" },
  { id: "rls_security", label: "RLS / tenant isolation", group: "Security" },
  { id: "data_integrity", label: "Data integrity / ledger", group: "Integrity" },
  { id: "performance", label: "Pagination / bounded loads", group: "Performance" },
  { id: "hw_barcode_scan", label: "Barcode scanner", group: "Hardware" },
  { id: "hw_barcode_gen", label: "Barcode generation", group: "Hardware" },
  { id: "hw_barcode_print", label: "Barcode / label printer", group: "Hardware" },
  { id: "hw_thermal", label: "Thermal receipt printer", group: "Hardware" },
  { id: "hw_scale", label: "Weighing scale", group: "Hardware" },
  { id: "hw_android", label: "Android camera / print / share", group: "Hardware" },
];
