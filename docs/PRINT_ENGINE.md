# Universal Print Engine

This is the only document printing framework. Do not call `window.print()` for business documents, create bespoke PDFs, or hand-roll print markup.

A printable route supplies a registered document type and record id to `PrintEngine`. The data mapper returns a renderer-neutral `PrintDocumentData`; the selected template defines sections; the same template drives screen preview and `generateDocumentPdf`. User print setup controls page size, margins, orientation, printer, and copies.

To add a future document:

1. Register its `PrintDocType` and label.
2. Add a pure data-mapper builder in `src/lib/print-engine/data-mapper.ts`.
3. Add/register the section template in `default-templates.ts`.
4. Use the existing Print Engine route/control and audit logging.

Billing documents, orders, job cards, statements, and Version 1 manufacturing/ledger print flows use the shared integration. Barcode labels and thermal receipts use specialized adapters within the Universal Print workflow because their device/page protocols differ from A4 output.

The PDF generator is also reused by email and WhatsApp preparation. Files remain local. Every output must use configured firm/brand data and must never invent a company name, address, tax id, or printer.
