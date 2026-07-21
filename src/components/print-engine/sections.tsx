/**
 * Unified Print Engine — section renderers.
 *
 * One component per SectionType (types.ts). `header` and `qr` are
 * deliberately NOT rendered here — PrintEngine.tsx reads those two
 * section configs and feeds them into PrintLayout's own existing
 * header/QR chrome as props, so the firm/branch header and QR code are
 * drawn exactly once (by PrintLayout, already correct, already in
 * production) rather than duplicated by a second renderer.
 */
import { useSettings } from "@/lib/settings-store";
import { PrintQR } from "@/components/print-qr";
import { Logo } from "@/components/ui/Logo";
import type {
  BalanceCardSectionConfig,
  BilledToStampSectionConfig,
  DataListSectionConfig,
  FieldGridSectionConfig,
  ImagesSectionConfig,
  PartySectionConfig,
  PremiumHeaderSectionConfig,
  PrintDocumentData,
  QrSectionConfig,
  RichTextSectionConfig,
  RowSectionConfig,
  SectionConfig,
  SignatureBlockSectionConfig,
  TableSectionConfig,
  TagCardsSectionConfig,
  ThermalItemListSectionConfig,
} from "@/lib/print-engine/types";
import { formatFieldValue, getPath, isVisible } from "@/lib/print-engine/resolve";

const BADGE_VARIANT_CLASSES: Record<"neutral" | "warning" | "critical" | "success", string> = {
  neutral: "border-stone-400 text-stone-700 bg-stone-50",
  warning: "border-amber-400 text-amber-800 bg-amber-50",
  critical: "border-red-400 text-red-700 bg-red-50",
  success: "border-emerald-400 text-emerald-700 bg-emerald-50",
};

const DARK_PANEL_TEXT_CLASSES: Record<"neutral" | "warning" | "critical" | "success", string> = {
  neutral: "text-purple-200",
  warning: "text-amber-300",
  critical: "text-rose-300",
  success: "text-emerald-400",
};

// ── party ────────────────────────────────────────────────────────────────

function PartySection({ config, data }: { config: PartySectionConfig; data: PrintDocumentData }) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const name = formatFieldValue(getPath(data.fields, config.namePath));
  return (
    <div className="mb-4">
      {config.title && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
          {config.title}
        </div>
      )}
      <div className="font-semibold text-sm text-stone-900">{name}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-xs text-stone-600">
        {config.subFields
          .filter((f) => isVisible(f.showIf, data.flags))
          .map((f) => (
            <div key={f.label} className={f.fullWidth ? "col-span-2" : undefined}>
              {f.label}:{" "}
              <span className="font-medium">
                {formatFieldValue(getPath(data.fields, f.valuePath))}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── fieldGrid ────────────────────────────────────────────────────────────

function FieldGridSection({
  config,
  data,
}: {
  config: FieldGridSectionConfig;
  data: PrintDocumentData;
}) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const cols = config.columns ?? 2;
  const fields = config.fields.filter((f) => isVisible(f.showIf, data.flags));

  if (config.theme === "darkPanel") {
    return (
      <div className="mb-4 rounded-xl bg-purple-950 text-white p-5 space-y-2 font-mono text-xs shadow-md">
        {config.title && (
          <div className="text-[10px] uppercase tracking-wider text-purple-300 mb-1">
            {config.title}
          </div>
        )}
        {fields.map((f) => (
          <div
            key={f.label}
            className={`flex justify-between ${f.emphasis ? "border-t-2 border-amber-400/80 pt-2 font-black text-sm" : ""} ${f.variant ? DARK_PANEL_TEXT_CLASSES[f.variant] : "text-purple-200"}`}
          >
            <span className={f.emphasis ? "font-serif uppercase text-amber-300 text-xs" : ""}>
              {f.label}:
            </span>
            <span className={f.emphasis ? "text-amber-300" : ""}>
              {formatFieldValue(getPath(data.fields, f.valuePath))}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-4">
      {config.title && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
          {config.title}
        </div>
      )}
      <div
        className="grid gap-x-4 gap-y-1 text-xs"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {fields.map((f) => (
          <div key={f.label} className={f.fullWidth ? "col-span-full" : undefined}>
            <span className="text-stone-500 uppercase text-[10px] block">{f.label}</span>
            {f.variant ? (
              <span
                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${BADGE_VARIANT_CLASSES[f.variant]}`}
              >
                {formatFieldValue(getPath(data.fields, f.valuePath))}
              </span>
            ) : (
              <span
                className={`font-medium text-stone-900 whitespace-pre-line ${f.emphasis ? "text-sm font-bold" : ""}`}
              >
                {formatFieldValue(getPath(data.fields, f.valuePath))}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── table ────────────────────────────────────────────────────────────────

function TableCell({
  column,
  row,
  value,
}: {
  column: TableSectionConfig["columns"][number];
  row: Record<string, unknown>;
  value: unknown;
}) {
  if (column.renderAs === "image") {
    const src = typeof value === "string" ? value : "";
    return src ? (
      <img
        src={src}
        alt=""
        className="h-10 w-10 object-cover rounded border border-stone-300 mx-auto"
      />
    ) : (
      <div className="h-10 w-10 rounded bg-stone-50 flex items-center justify-center text-stone-400 text-[9px] mx-auto border border-stone-200">
        —
      </div>
    );
  }
  if (column.renderAs === "badge") {
    const variant = row[`${column.key}Variant`];
    const cls =
      typeof variant === "string" && variant in BADGE_VARIANT_CLASSES
        ? BADGE_VARIANT_CLASSES[variant as keyof typeof BADGE_VARIANT_CLASSES]
        : BADGE_VARIANT_CLASSES.neutral;
    return (
      <span
        className={`inline-block px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${cls}`}
      >
        {formatFieldValue(value)}
      </span>
    );
  }
  // Multi-line cells: the data mapper joins sub-fields (barcode, HUID, stone
  // weight, etc.) with "\n" — pre-line preserves those as stacked lines
  // instead of collapsing to a single line, matching the legacy invoice's
  // stacked item-description cell without a dedicated section type.
  return <span className="whitespace-pre-line">{formatFieldValue(value)}</span>;
}

function TableSection({ config, data }: { config: TableSectionConfig; data: PrintDocumentData }) {
  const { firm, branding } = useSettings();
  if (!isVisible(config.showIf, data.flags)) return null;
  const rows = data.tables[config.rowsPath] ?? [];
  const columns = config.columns.filter((c) => isVisible(c.showIf, data.flags));
  const footerRow = config.footerRowPath ? data.tables[config.footerRowPath]?.[0] : undefined;
  const totalWidth = columns.reduce((s, c) => s + (c.width ?? 1), 0) || 1;

  // Rendered inside <thead>, so the browser repeats it on every printed page.
  const repeatMeta = (config.repeatHeaderMeta ?? [])
    .map((m) => ({ label: m.label, value: formatFieldValue(getPath(data.fields, m.valuePath)) }))
    .filter((m) => m.value && m.value !== "—");

  return (
    <div className="mb-4">
      {config.title && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
          {config.title}
        </div>
      )}
      <table className="w-full text-xs table-fixed">
        {/* Fixed layout + proportional colgroup so a long description can never
            widen the table past the page — it wraps instead of overflowing. */}
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={{ width: `${((c.width ?? 1) / totalWidth) * 100}%` }} />
          ))}
        </colgroup>
        <thead>
          {repeatMeta.length > 0 && (
            <tr>
              <th
                colSpan={columns.length}
                className="border border-stone-400 px-1.5 py-0.5 bg-stone-50 text-left font-normal"
              >
                <span className="font-serif font-bold text-stone-900">
                  {branding.printHeader || firm.shopName || branding.applicationName}
                </span>
                {repeatMeta.map((m) => (
                  <span key={m.label} className="text-stone-600">
                    {"  ·  "}
                    <span className="uppercase text-[9px] text-stone-500">{m.label}: </span>
                    <span className="font-semibold text-stone-800">{m.value}</span>
                  </span>
                ))}
              </th>
            </tr>
          )}
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="border border-stone-400 px-1.5 py-0.5 bg-stone-100 font-semibold break-words"
                style={{ textAlign: c.align ?? "left" }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="print:break-inside-avoid">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="border border-stone-300 px-1.5 py-0.5 break-words align-top"
                  style={{ textAlign: c.align ?? "left" }}
                >
                  <TableCell column={c} row={row} value={row[c.key]} />
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="border border-stone-300 px-1.5 py-2 text-center text-stone-400"
              >
                No rows
              </td>
            </tr>
          )}
        </tbody>
        {config.showFooterSums && rows.length > 0 && (
          <tfoot>
            <tr>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="border border-stone-400 px-1.5 py-0.5 font-semibold bg-stone-50"
                >
                  {c.footerSum
                    ? rows.reduce((sum, r) => sum + (Number(r[c.key]) || 0), 0).toString()
                    : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
        {footerRow && (
          <tfoot>
            <tr className="bg-stone-50 border-t-2 border-stone-800 font-bold">
              {columns.map((c) => (
                <td key={c.key} className="px-1.5 py-1.5" style={{ textAlign: c.align ?? "left" }}>
                  {formatFieldValue(footerRow[c.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── balanceCard ──────────────────────────────────────────────────────────

function BalanceCardSection({
  config,
  data,
}: {
  config: BalanceCardSectionConfig;
  data: PrintDocumentData;
}) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const inLabel = config.labelMode === "credit_debit" ? "Credit" : "Jama (In)";
  const outLabel = config.labelMode === "credit_debit" ? "Debit" : "Naam (Out)";

  const Card = ({
    title,
    figures,
  }: {
    title: string;
    figures: { previous: number; in: number; out: number; closing: number };
  }) => (
    <div className="border border-stone-300 rounded p-2 flex-1">
      <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
        {title}
      </div>
      <div className="text-xs space-y-0.5">
        <div className="flex justify-between">
          <span className="text-stone-500">Previous</span>
          <span>{figures.previous}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">{inLabel}</span>
          <span className="text-emerald-700">{figures.in}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">{outLabel}</span>
          <span className="text-red-700">{figures.out}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-stone-300 pt-0.5 mt-0.5">
          <span>Closing</span>
          <span>{figures.closing}</span>
        </div>
      </div>
    </div>
  );

  const gold = config.goldKey ? data.balances[config.goldKey] : undefined;
  const cash = config.cashKey ? data.balances[config.cashKey] : undefined;
  if (!gold && !cash) return null;

  return (
    <div className="mb-4">
      {config.title && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
          {config.title}
        </div>
      )}
      <div className="flex gap-3">
        {gold && <Card title="Gold" figures={gold} />}
        {cash && <Card title="Cash" figures={cash} />}
      </div>
    </div>
  );
}

// ── richText ─────────────────────────────────────────────────────────────

function RichTextSection({
  config,
  data,
}: {
  config: RichTextSectionConfig;
  data: PrintDocumentData;
}) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const text = config.textPath
    ? formatFieldValue(getPath(data.fields, config.textPath))
    : config.staticText;
  if (!text || text === "—") return null;

  if (config.emphasis === "inline") {
    return (
      <div className="mb-4 font-mono bg-stone-50 px-3 py-2 rounded-lg border border-stone-200 text-stone-700 text-xs">
        {config.title && (
          <span className="font-semibold text-stone-500 uppercase text-[10px]">
            {config.title}:{" "}
          </span>
        )}
        <strong className="text-purple-950">{text}</strong>
      </div>
    );
  }

  if (config.emphasis === "plain") {
    return (
      <div className="text-[10px] text-stone-500 leading-relaxed space-y-1">
        {config.title && (
          <h4 className="font-bold text-stone-700 uppercase tracking-wider text-[9px] font-serif">
            {config.title}
          </h4>
        )}
        <div className="whitespace-pre-line">{text}</div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {config.title && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
          {config.title}
        </div>
      )}
      <p className="text-xs text-stone-700 whitespace-pre-wrap border border-stone-200 rounded-md p-3">
        {text}
      </p>
    </div>
  );
}

// ── images ───────────────────────────────────────────────────────────────

function ImagesSection({ config, data }: { config: ImagesSectionConfig; data: PrintDocumentData }) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const images = (data.images[config.imagesKey] ?? []).slice(0, config.maxThumbnails ?? 8);
  if (images.length === 0) return null;
  return (
    <div className="mb-4">
      {config.title && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
          {config.title}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className={
              config.fullPagePerImage
                ? "w-full h-auto print:break-before-page"
                : "h-20 w-20 object-cover rounded border border-stone-300"
            }
          />
        ))}
      </div>
    </div>
  );
}

// ── signatureBlock ───────────────────────────────────────────────────────

function SignatureBlockSection({
  config,
  data,
}: {
  config: SignatureBlockSectionConfig;
  data: PrintDocumentData;
}) {
  const { firm, branding } = useSettings();
  if (!isVisible(config.showIf, data.flags)) return null;
  const left = config.leftLabel || firm.signatureLabelLeft || "Customer Signature";
  const right = config.rightLabel || firm.signatureLabelRight || "Authorised Signatory";
  const leftCaption = config.leftCaptionPath
    ? formatFieldValue(getPath(data.fields, config.leftCaptionPath))
    : undefined;
  const rightCaption = config.rightCaptionPath
    ? formatFieldValue(getPath(data.fields, config.rightCaptionPath))
    : undefined;
  return (
    <div className="mt-8 grid grid-cols-2 gap-8 text-center text-stone-600 font-mono text-[10px]">
      <div className="flex flex-col justify-end min-h-[60px]">
        <div className="border-t border-stone-400 pt-1.5 font-semibold text-stone-800 uppercase tracking-wide">
          {left}
        </div>
        {leftCaption && <p className="text-[9px] text-stone-400 mt-0.5">({leftCaption})</p>}
      </div>
      <div className="flex flex-col justify-end min-h-[60px]">
        {config.showStamp && (
          <div className="mx-auto mb-2 font-serif text-[11px] text-purple-950 font-black tracking-widest border border-purple-950/30 px-2.5 py-0.5 rounded opacity-60 -rotate-2">
            {branding.printHeader || firm.shopName || branding.applicationName}
          </div>
        )}
        <div className="border-t border-stone-400 pt-1.5 font-semibold text-stone-800 uppercase tracking-wide">
          {right}
        </div>
        {rightCaption && <p className="text-[9px] text-stone-400 mt-0.5">({rightCaption})</p>}
      </div>
    </div>
  );
}

// ── qr (standalone) ──────────────────────────────────────────────────────
// Unlike `header`, a standalone `qr` section renders directly — it's only
// used by documents that don't go through PrintLayout at all (their own
// custom shell, e.g. the GST/retail invoice's thermal layout). Documents
// that DO use PrintLayout rely on its own built-in header QR instead and
// simply never include a `qr` section in their template.

function QrSection({ config, data }: { config: QrSectionConfig; data: PrintDocumentData }) {
  if (!isVisible(config.showIf, data.flags)) return null;
  return (
    <div className="flex flex-col items-center justify-center pt-1 text-center space-y-1.5">
      <PrintQR
        docType={data.docType}
        docNumber={data.docNumber}
        recordId={data.recordId}
        createdAt={data.createdAt}
        size={config.size ?? 64}
        label={config.label ?? "Verify"}
      />
    </div>
  );
}

// ── premiumHeader / compact header ──────────────────────────────────────

function PremiumHeaderSection({
  config,
  data,
}: {
  config: PremiumHeaderSectionConfig;
  data: PrintDocumentData;
}) {
  const { firm, branding } = useSettings();
  const badgeTitle = formatFieldValue(getPath(data.fields, config.badgeTitlePath));
  const dateLabel = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })
    : "";

  if (config.variant === "compact") {
    return (
      <div className="text-center pb-2 border-b border-dashed border-slate-300 mb-3">
        <h2 className="font-serif text-sm font-black tracking-tight uppercase text-purple-950">
          {branding.printHeader || firm.shopName || branding.applicationName}
        </h2>
        <p className="text-[8px] font-serif uppercase tracking-widest text-slate-600">
          {firm.tagline || branding.tagline}
        </p>
        <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">
          {firm.address ? `${firm.address.slice(0, 48)}...` : ""}
        </p>
        <p className="text-[8px] font-semibold text-slate-600 mt-0.5">Mob: {firm.phone || ""}</p>
        {firm.gstin && (
          <p className="text-[8px] font-bold text-slate-700 uppercase mt-0.5">GST: {firm.gstin}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-between items-start border-b border-neutral-200 pb-6 mb-6 mt-2">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          {firm.logoUrl ? (
            <Logo variant="png" className="h-12 w-12 object-contain flex-shrink-0 rounded-xl" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-purple-950 flex items-center justify-center border border-amber-400 shrink-0 shadow-md" />
          )}
          <div>
            <h1 className="font-serif text-2xl font-black text-purple-950 tracking-tight leading-none">
              {branding.printHeader || firm.shopName || branding.applicationName}
            </h1>
            <p className="text-[10px] text-amber-600 font-bold tracking-widest uppercase mt-0.5 font-mono">
              {firm.tagline || branding.tagline}
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-650 space-y-1 mt-2 max-w-md">
          <p className="leading-relaxed">{firm.address}</p>
          <p className="font-mono">
            Mob: <span className="font-semibold text-slate-850">{firm.phone || ""}</span>{" "}
            {firm.email && `| Email: ${firm.email}`}
          </p>
          {firm.website && (
            <p className="font-mono">
              Web: <span className="font-semibold">{firm.website}</span>
            </p>
          )}
          {firm.gstin && (
            <div className="inline-block bg-purple-50 text-purple-950 font-bold font-mono text-[10px] px-2 py-0.5 rounded border border-purple-100 uppercase">
              GSTIN: {firm.gstin}
            </div>
          )}
        </div>
      </div>

      <div className="text-right flex flex-col items-end gap-3">
        <div className="bg-amber-500 text-purple-950 px-4 py-1.5 rounded-lg border border-amber-400 font-bold font-serif uppercase tracking-wider text-xs shadow-sm">
          {badgeTitle}
        </div>
        <div className="text-xs space-y-1 font-mono text-slate-600">
          <div>
            Voucher No: <span className="font-bold text-purple-950">{data.docNumber}</span>
          </div>
          {dateLabel && (
            <div>
              Date: <span className="font-semibold text-slate-900">{dateLabel}</span>
            </div>
          )}
          {data.flags.hasOrderNo && (
            <div>
              Order Ref:{" "}
              <span className="font-semibold text-purple-900">
                #{formatFieldValue(getPath(data.fields, "orderNo"))}
              </span>
            </div>
          )}
          {data.flags.hasJobNo && (
            <div>
              Job Card:{" "}
              <span className="font-semibold text-purple-900">
                #{formatFieldValue(getPath(data.fields, "jobNo"))}
              </span>
            </div>
          )}
        </div>
        {config.showQr && (
          <div className="pt-1 flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded p-1">
            <PrintQR
              docType={data.docType}
              docNumber={data.docNumber}
              recordId={data.recordId}
              createdAt={data.createdAt}
              size={config.qrSize ?? 40}
              label={config.qrLabel ?? "Secure Receipt"}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── billedToStamp ────────────────────────────────────────────────────────

function BilledToStampSection({
  config,
  data,
}: {
  config: BilledToStampSectionConfig;
  data: PrintDocumentData;
}) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const name = formatFieldValue(getPath(data.fields, config.namePath));
  return (
    <div className="grid grid-cols-2 gap-6 bg-purple-50/40 rounded-xl border border-purple-100 p-4 mb-6">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 font-mono">
          Billed To (Customer Details)
        </span>
        <div className="font-serif font-black text-purple-950 text-base mt-1">{name}</div>
        {config.subFields
          .filter((f) => isVisible(f.showIf, data.flags))
          .map((f) => (
            <div key={f.label} className="text-xs text-slate-600 font-mono mt-0.5">
              {f.label}:{" "}
              <span className="font-medium text-slate-800">
                {formatFieldValue(getPath(data.fields, f.valuePath))}
              </span>
            </div>
          ))}
      </div>
      <div className="text-right flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 font-mono">
            Security Stamp
          </span>
          <div className="flex items-center justify-end gap-1 text-xs text-emerald-700 font-bold mt-1">
            <span>✓ {config.stampLabel ?? "ORIGINAL TRANS-REC"}</span>
          </div>
        </div>
        {data.flags.isReprint && (
          <div className="text-[11px] text-rose-600 font-bold font-mono">
            REPRINT RECORD ({formatFieldValue(getPath(data.fields, "reprintCount"))})
          </div>
        )}
      </div>
    </div>
  );
}

// ── tagCards ─────────────────────────────────────────────────────────────

function TagCardsSection({
  config,
  data,
}: {
  config: TagCardsSectionConfig;
  data: PrintDocumentData;
}) {
  const { firm, branding } = useSettings();
  if (!isVisible(config.showIf, data.flags)) return null;
  const rows = data.tables[config.rowsPath] ?? [];
  return (
    <div className="flex flex-col gap-3 mx-auto items-center">
      {rows.map((row, i) => (
        <div
          key={i}
          className="w-[50mm] min-h-[30mm] bg-white border border-neutral-300 rounded shadow-md p-1.5 print:border print:shadow-none font-mono text-[7px] leading-tight relative overflow-hidden print:break-inside-avoid"
        >
          <div className="text-center font-serif text-[8px] font-black text-purple-950 uppercase tracking-tight mt-0.5">
            {branding.shortName || firm.brandName || firm.shopName || "ERP"}
          </div>
          <div className="border-t border-dashed border-slate-300 my-0.5" />
          <div className="font-bold text-[8px] text-slate-900 leading-tight truncate">
            {formatFieldValue(row.itemName)}
          </div>
          <div className="flex justify-between mt-0.5 text-slate-600">
            <span>GW: {formatFieldValue(row.grossWt)}</span>
            <span>NW: {formatFieldValue(row.netWt)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Pty: {formatFieldValue(row.purity)}</span>
            {!!row.huid && (
              <span className="font-mono text-[6px]">HUID: {formatFieldValue(row.huid)}</span>
            )}
          </div>
          {!!row.barcode && (
            <div className="text-[6px] text-amber-700 font-mono">
              Tag: {formatFieldValue(row.barcode)}
            </div>
          )}
          <div className="border-t border-dashed border-slate-300 my-0.5" />
          <div className="flex justify-between font-black text-[9px] text-purple-950">
            <span>{data.docNumber}</span>
            <span>{formatFieldValue(row.totalLabel)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── dataList ─────────────────────────────────────────────────────────────

function DataListSection({
  config,
  data,
}: {
  config: DataListSectionConfig;
  data: PrintDocumentData;
}) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const rows = data.tables[config.rowsPath] ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="mb-4">
      {config.title && (
        <div className="text-xs font-bold uppercase tracking-wider text-purple-950 border-b border-purple-100 pb-2 mb-2 font-mono">
          {config.title}
        </div>
      )}
      <ul className="text-xs space-y-1.5 font-mono text-slate-700">
        {rows.map((row, i) => (
          <li
            key={i}
            className="flex justify-between items-center border-b border-neutral-100 pb-1 last:border-0 last:pb-0"
          >
            <span className="font-semibold text-slate-600">
              {formatFieldValue(row[config.labelKey])}
              {config.subKey && row[config.subKey]
                ? ` [${formatFieldValue(row[config.subKey])}]`
                : ""}
              :
            </span>
            <span className="font-bold text-slate-900">
              {formatFieldValue(row[config.valueKey])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── thermalItemList ──────────────────────────────────────────────────────

function ThermalItemListSection({
  config,
  data,
}: {
  config: ThermalItemListSectionConfig;
  data: PrintDocumentData;
}) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const rows = data.tables[config.rowsPath] ?? [];
  return (
    <div>
      <div className="text-[8px] font-bold uppercase text-slate-500 tracking-wider mb-1">
        TRANS-ITEMS DETAILS
      </div>
      <div className="space-y-1.5 divide-y divide-dotted divide-slate-200">
        {rows.map((row, i) => (
          <div key={i} className="pt-1.5 first:pt-0">
            <div className="flex justify-between font-bold">
              <span>{formatFieldValue(row.itemNameShort)}</span>
              <span>{formatFieldValue(row.totalLabel)}</span>
            </div>
            <div className="flex justify-between text-[8px] text-slate-500 font-sans">
              <span>{formatFieldValue(row.weightSummary)}</span>
              <span>
                HUID: {formatFieldValue(row.huid) === "—" ? "—" : formatFieldValue(row.huid)}
              </span>
            </div>
            {!!row.stoneSummary && (
              <div className="text-[7px] text-slate-500 font-mono">
                {formatFieldValue(row.stoneSummary)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── row (layout wrapper) ─────────────────────────────────────────────────

function RowSection({ config, data }: { config: RowSectionConfig; data: PrintDocumentData }) {
  if (!isVisible(config.showIf, data.flags)) return null;
  const widths = config.columnWidths ?? config.columns.map(() => 1);
  return (
    <div
      className="grid gap-6 items-start mb-4"
      style={{ gridTemplateColumns: widths.map((w) => `${w}fr`).join(" ") }}
    >
      {config.columns.map((col, i) => (
        <div key={i}>{col.map((s) => renderSection(s, data))}</div>
      ))}
    </div>
  );
}

// ── registry ─────────────────────────────────────────────────────────────

/**
 * Section types PrintSections renders directly. `header` is the one
 * exception — always proxied to PrintLayout's own header, see
 * PrintEngine.tsx. `qr` renders directly (see QrSection above) for
 * documents with their own custom shell that never mounts PrintLayout.
 */
export function renderSection(config: SectionConfig, data: PrintDocumentData) {
  switch (config.type) {
    case "party":
      return <PartySection key={config.id} config={config} data={data} />;
    case "fieldGrid":
      return <FieldGridSection key={config.id} config={config} data={data} />;
    case "table":
      return <TableSection key={config.id} config={config} data={data} />;
    case "balanceCard":
      return <BalanceCardSection key={config.id} config={config} data={data} />;
    case "richText":
      return <RichTextSection key={config.id} config={config} data={data} />;
    case "images":
      return <ImagesSection key={config.id} config={config} data={data} />;
    case "signatureBlock":
      return <SignatureBlockSection key={config.id} config={config} data={data} />;
    case "pageBreak":
      return <div key={config.id} className="print:break-before-page" />;
    case "qr":
      return <QrSection key={config.id} config={config} data={data} />;
    case "premiumHeader":
      return <PremiumHeaderSection key={config.id} config={config} data={data} />;
    case "billedToStamp":
      return <BilledToStampSection key={config.id} config={config} data={data} />;
    case "tagCards":
      return <TagCardsSection key={config.id} config={config} data={data} />;
    case "dataList":
      return <DataListSection key={config.id} config={config} data={data} />;
    case "thermalItemList":
      return <ThermalItemListSection key={config.id} config={config} data={data} />;
    case "row":
      return <RowSection key={config.id} config={config} data={data} />;
    case "header":
      return null; // rendered by PrintLayout, see PrintEngine.tsx
    default:
      return null;
  }
}

export function PrintSections({
  sections,
  data,
}: {
  sections: SectionConfig[];
  data: PrintDocumentData;
}) {
  return <>{sections.map((s) => renderSection(s, data))}</>;
}
