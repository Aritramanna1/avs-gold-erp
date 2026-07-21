# UI Guidelines

## Foundation

- **Tailwind** utility classes + **Radix UI** primitives wrapped in `src/components/ui/*` (Button, Input, Select, Dialog, DropdownMenu, Tabs, AlertDialog, …). Use these wrappers; do not pull raw Radix or a second component kit.
- Icons: `lucide-react` only.
- Toasts: `sonner` (`toast.success/error/warning/loading`). Use `toast.loading` + `{ id }` update for async actions.

## Design language

- Gold-accented dark theme. Accent class `text-gold` / `bg-gold`; serif display headings (`font-serif`), muted secondary text (`text-muted-foreground`).
- Cards: `rounded-2xl border border-border bg-card p-5 shadow-elegant`.
- Weights shown in grams with 3 decimals (mg precision); purity as carat label (`getCaratLabel`). Money as ₹ with `paiseToRupees`.

## Patterns

- **Dashboards are scannable**: KPI cards up top, drill-down on click, detail lives in the owning module. Overview screens never double as transaction-entry screens.
- **Print/Export affordance**: every summary/report view offers Print (Print Engine) + Export (`report-engine`). Mark print-only/no-print regions with the `no-print` / `print:` utilities.
- **Coming Soon**: unbuilt sub-modules show a professional placeholder (icon + "Coming Soon" badge + one line), never a broken/empty screen. Do not ship partial functionality.
- **Communication**: green WhatsApp actions (`#25D366`). Document sends use `WhatsAppDocMenu`; ad-hoc text uses `DocCommActions`.

## Accessibility

- Interactive non-button elements get `role="button"`, `tabIndex`, and keyboard handlers (Enter/Space).
- Buttons that require valid data (a phone, a record) are disabled with an explanatory `title`.
- Never rely on color alone for status — pair with a label/icon.

## Forms

- Draft-persist long forms with `useDraft` where it already applies.
- Show inline validation errors; never silently no-op a failed submit.
- Confirm irreversible actions with `AlertDialog`.

## Responsiveness

Grid/flex with `sm:`/`md:`/`lg:` breakpoints; wide tables scroll inside `overflow-x-auto`. The app targets desktop Electron first.
