# Universal Print Engine

**The only printing framework.** Every printable document routes through it. Do not call `window.print()` for documents, build a bespoke PDF generator, or hand-roll print markup.

## Shape

A route becomes a thin wrapper:

```tsx
<PrintEngine docType="daily_material_slip" recordId={`${workerId}~${date}`} backUrl="/workshop/gold-book" />
```

The engine handles preview, printer selection, paper-size switch, PDF download, and reprint-audit uniformly.

## The three parts of migrating a document

1. **docType** — add to `PrintDocType` union + `PRINT_DOC_LABELS` (`src/lib/printlog-store.ts`).
2. **Data-mapper builder** — a pure function `(recordId) → PrintDocumentData | null` registered in `src/lib/print-engine/data-mapper.ts`. It reads the owning store and returns the flat, renderer-agnostic shape: `{ docType, docNumber, recordId, createdAt, title, fields, tables, flags, images, balances }`. Return `null` for not-found.
3. **Template** — a section list in `src/lib/print-engine/default-templates.ts`, registered in `DEFAULT_TEMPLATES`. Sections: `header`, `fieldGrid`, `party`, `table`, `row`, `richText`, `balanceCard`, `signatureBlock`, `qr`, `images`, `pageBreak`, `tagCards`, `thermalItemList`.

One template drives **both** the on-screen preview (`src/components/print-engine/sections.tsx`) and the exported PDF (`src/lib/print-engine/pdf/generate.ts`) — layout changes in one place reflect everywhere.

## PDF generation

`generateDocumentPdf(data, template, firm): Promise<{ blob, fileName }>` walks the template with the shared jsPDF toolkit (`pdf/toolkit.ts`). Honors the user's page setup (`print-setup-store.ts`). This is the **single** PDF entry point — the WhatsApp document sender (`send-whatsapp-document.ts`) reuses it so a document is never generated twice.

## Registered docTypes (have builders)

`gst_invoice`, `retail_invoice`, `credit_note`, `debit_note`, `estimate_doc`, `delivery_challan`, `order_slip`, `job_card`, `karigar_custody_statement`, `customer_ledger_statement`, `daily_material_slip`.

## Not on the document engine (intentional)

Barcode/label printing and thermal receipts use dedicated hardware paths (`thermal-printer.ts`, `BarcodeLabelPreview.tsx`). Forcing them through the A4/PDF document engine would break physical printing — they stay separate.

## Migration status

Phased. Billing docs, orders, job cards, statements, and the Daily Material Slip are on the engine. Remaining self-contained document prints (receive/filings slips, Material Issue Slip, some reports) migrate document-by-document following the three-step pattern above.
