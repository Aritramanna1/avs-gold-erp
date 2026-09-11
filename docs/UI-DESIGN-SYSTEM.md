# AVS Gold ERP — Canonical UI Design System & Authoritative Rulebook

> **Authoritative Specification & Project-Wide Invariant**  
> **Document Status**: CANONICAL & PERMANENT  
> **Location**: `docs/UI-DESIGN-SYSTEM.md`  
> **Core Principle**: *One ERP &bull; One Visual Language &bull; One Component System &bull; One UX Standard*

---

## 1. Permanent Development Rule

> [!IMPORTANT]
> **ALL NEW AVS ERP UI MUST FOLLOW `docs/UI-DESIGN-SYSTEM.md` AND EXISTING APPROVED UI COMPONENTS. NO NEW VISUAL LANGUAGE MAY BE INTRODUCED WITHOUT EXPLICIT PROJECT-OWNER APPROVAL.**

This rule applies universally to:
- Platform Owner Console (`/platform/*`)
- Core ERP Business Modules (Retail POS, Wholesale, Orders, Inventory, Stock, Melting, Workshop, Karigar, Payroll, Ledger, Accounts, Reports)
- Customer, Supplier, and Karigar Portals
- Authentication, Onboarding, Invite Acceptance & Account Recovery
- Settings, Automation & Document Configuration
- OAuth Consent, Tool Approvals & MCP Server Management
- All Future Modules and Add-ons

---

## 2. Core Visual Language & Design Philosophy

AVS Gold ERP is a precision operational platform engineered specifically for high-value jewellery manufacturing, bullion trading, hallmarking compliance, and multi-counter retail showrooms.

### Visual Pillars:
1. **Quiet Operational Density**: Clean parchment/canvas surfaces, sharp 1px borders, subtle radii (`rounded-md`), and high data density without clutter.
2. **Authoritative Heritage Accent**: Legacy Gold (`--avs-gold` / `--color-gold`: `#a88445` in light, `#c9a227` in dark) used selectively for headers, primary badges, and key financial balances.
3. **Single Action Accent**: Crisp blue (`--avs-action`: `#0066cc` / `#2997ff`) for hyperlinks and primary interactive CTA flows.
4. **Strict Component Reusability**: Never invent ad-hoc button shapes, custom cards with rogue background colors (`bg-slate-900`, `bg-zinc-800`), or custom spinners.

---

## 3. Semantic Design Tokens

All colors, dimensions, and typography are driven by semantic CSS variables defined in `tokens.css` and `src/styles.css`.

### 3.1 Color Tokens

| Token | Class Name | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Background** | `bg-background` | `#f5f5f7` (parchment) | `#1d1d1f` (parchment dark) | Global page background |
| **Surface / Card** | `bg-card` / `erp-surface` | `#ffffff` (canvas) | `#272729` (canvas dark) | Content cards, tables, modal containers |
| **Muted Surface** | `bg-muted` | `#fafafc` (pearl) | `#2f2f31` (pearl dark) | Table headers, secondary control bars |
| **Foreground Text** | `text-foreground` | `#1d1d1f` (ink) | `#f5f5f7` (ink light) | Primary body text, headings |
| **Muted Text** | `text-muted-foreground` | `#6e6e73` (ink muted) | `#a1a1a6` (ink muted dark) | Helper labels, captions, metadata |
| **Brand Gold** | `text-gold` / `border-gold` | `#a88445` | `#c9a227` | Module headings, brand mark, gold metrics |
| **Primary Action** | `bg-primary` / `text-primary` | `#0066cc` | `#2997ff` | Primary action buttons, focused links |
| **Border / Line** | `border-border` | `#e0e0e0` (line) | `rgba(255,255,255,0.12)` | 1px clean separation borders |
| **Destructive** | `text-destructive` / `bg-destructive` | `#c9342a` | `#ef4444` | Deletion, suspension, critical errors |
| **Success** | `text-emerald-500` / `bg-emerald-500` | `#1f7a45` | `#10b981` | Paid status, active tags, verified states |
| **Warning** | `text-amber-500` / `bg-amber-500` | `#b45309` | `#f59e0b` | Pending approvals, trial alerts |

### 3.2 Radius Tokens

| Radius Token | Tailwind Class | Pixel Value | Intended Usage |
| :--- | :--- | :--- | :--- |
| `--radius-sm` | `rounded-sm` | `4px` | Badges, small tags |
| `--radius-md` | `rounded-md` | `6px` / `8px` | **Canonical default** for buttons, inputs, cards |
| `--radius-lg` | `rounded-lg` | `11px` | Large dialogs, master containers |
| `--radius-pill` | `rounded-full` | `9999px` | Avatars, status indicator dots |

> [!WARNING]
> **Prohibited Radii**: Do not use `rounded-2xl` or `rounded-3xl` on operational forms, cards, or tables.

---

## 4. Typography Scale & Stacks

### 4.1 Font Stacks
- **Display / Headers (`font-serif`)**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (styled with bold/serif weight for luxury jewellery tone).
- **Body (`font-sans`)**: `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Numbers / Codes / Financials (`font-mono`)**: `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace`.

### 4.2 Type Hierarchy

| Level | Classes | Usage |
| :--- | :--- | :--- |
| **Page Title** | `font-serif text-xl md:text-2xl font-bold text-foreground` / `text-gold` | Top-level screen header via `PageHeader` |
| **Section Title** | `font-serif text-base font-bold text-foreground` | Card group titles, modal headers |
| **Card Header** | `text-sm font-semibold text-foreground` | Sub-section cards |
| **Body Default** | `text-xs text-foreground` | Form inputs, table cells, paragraphs |
| **Helper / Caption** | `text-[11px] text-muted-foreground` | Form descriptions, footnotes |
| **Micro Badge / Stat** | `text-[10px] font-mono uppercase font-bold` | Status badges, table column headers |

---

## 5. Canonical Component Rules

### 5.1 Page Shell & Headers
Every top-level page must use `PageHeader` from `@/components/app-shell`:
```tsx
import { PageHeader } from "@/components/app-shell";

<PageHeader
  title="Module Name"
  subtitle="Authoritative description of current operational workflow"
/>
```

### 5.2 Cards & Surfaces
All cards must use `@/components/ui/card` or `erp-surface`:
```tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

<Card className="border border-border bg-card shadow-xs">
  <CardHeader className="p-5 pb-3">
    <CardTitle className="font-serif text-base font-bold text-foreground">Section Title</CardTitle>
    <CardDescription className="text-xs text-muted-foreground">Subtitle context</CardDescription>
  </CardHeader>
  <CardContent className="p-5 pt-0">
    {/* Body */}
  </CardContent>
</Card>
```

### 5.3 Buttons
All buttons must use `@/components/ui/button`:
```tsx
import { Button } from "@/components/ui/button";

// Primary Action (Brand Gold)
<Button className="h-9 gap-1.5 text-xs font-bold bg-gold text-black hover:bg-gold/90 shadow-sm">
  <Plus className="h-3.5 w-3.5" /> Create Record
</Button>

// Secondary / Outline Action
<Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
  <RefreshCw className="h-3.5 w-3.5" /> Refresh
</Button>

// Destructive Action
<Button variant="destructive" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
  <Trash2 className="h-3.5 w-3.5" /> Delete
</Button>
```

### 5.4 Form Controls & Layout
All inputs and selects must have:
- Standard control height: `h-9`
- Standard typography: `text-xs`
- Standard styling: `bg-background border-border focus:ring-1 focus:ring-gold`
- Explicit `Label` from `@/components/ui/label` with `text-xs font-medium text-foreground`

```tsx
<div className="space-y-1.5">
  <Label className="text-xs font-medium text-foreground">Field Label *</Label>
  <Input
    type="text"
    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
    placeholder="Enter value..."
  />
  <p className="text-[11px] text-muted-foreground">Contextual helper description.</p>
</div>
```

### 5.5 Tables
Tables must follow the single universal ERP standard:
```tsx
<div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
  <div className="overflow-x-auto">
    <table className="w-full text-xs text-left">
      <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
        <tr>
          <th className="p-3">Reference / Code</th>
          <th className="p-3">Name</th>
          <th className="p-3">Status</th>
          <th className="p-3 text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        <tr className="hover:bg-muted/40 transition-colors">
          <td className="p-3 font-mono font-semibold">REF-001</td>
          <td className="p-3 font-medium">Standard Row</td>
          <td className="p-3"><Badge>ACTIVE</Badge></td>
          <td className="p-3 text-right font-mono font-bold">₹10,000.00</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### 5.6 Status Badges
Status badges must use `@/components/ui/badge` with `font-mono text-[10px] uppercase font-bold`:
```tsx
// Active / Success
<Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[10px] font-mono uppercase font-bold">
  ACTIVE
</Badge>

// Pending / Warning
<Badge variant="outline" className="bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-mono uppercase font-bold">
  PENDING
</Badge>

// Inactive / Muted
<Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-mono uppercase font-bold">
  INACTIVE
</Badge>
```

---

## 6. Layout & Responsive Spacing Standards

- **Page Container**: `p-4 md:p-8 space-y-6 max-w-7xl mx-auto`
- **Stat Cards Grid**: `grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4`
- **Two-Column Split**: `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`
- **Form Columns**: `grid grid-cols-1 sm:grid-cols-2 gap-4`
- **Dialogs**: `max-w-2xl max-h-[90vh] overflow-y-auto`

### Breakpoint Matrix:
- **Mobile (<640px)**: Vertical single-column stacking, touch-friendly 44px hit targets, horizontal overflow guarded with table wrappers.
- **Tablet (640px - 1024px)**: 2-column grids, master-detail side panels, dense touch-friendly tables.
- **Desktop (>1024px)**: 4-column metrics, dense operational tables with keyboard navigation shortcuts.

---

## 7. Prohibited Patterns (Anti-Patterns)

The following practices are **STRICTLY FORBIDDEN**:

1. ❌ **Arbitrary Dark Palette Overrides**: Never use `bg-slate-900`, `bg-zinc-950`, `bg-gray-900`, `text-slate-300`, `ring-emerald-500/10` on component containers. Always use `bg-card`, `bg-background`, `text-foreground`, `border-border`.
2. ❌ **Custom Non-Standard Buttons**: Never create raw `<button className="px-6 py-2.5 bg-gradient-to-r from-amber-500...">`. Always use `<Button className="bg-gold text-black font-bold">`.
3. ❌ **Custom Floating Modal Shapes**: Never create un-contained floating modals with custom backdrop blur. Use `@/components/ui/dialog`.
4. ❌ **Giant Hero Visuals on Operational Pages**: ERP is an operational system; do not add decorative oversized hero banners or consumer marketing headers.
5. ❌ **Custom Ad-Hoc Checkbox / Switch Implementations**: Always use `@/components/ui/switch` or `@/components/ui/checkbox`.

---

## 8. Verification & Guarding

- **Linter Rule**: Automated check in `scripts/ui-linter.mjs` scans all TSX files for forbidden arbitrary color classes (`bg-slate-900`, `bg-zinc-900`, etc.) and un-tokenized inline styles.
- **CI Enforcement**: `npm run qa:ui-lint` must pass with zero violations before deployment.
