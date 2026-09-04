# MTJ / AVS ERP — UI RULES
## THE SINGLE AUTHORITATIVE DESIGN & UI GOVERNANCE SPECIFICATION

**Effective Date:** September 4, 2026  
**Governing System:** MTJ / AVS Gold & Diamond ERP  
**Scope:** Universal (Desktop ERP, Electron Host Shell, Portals, Setup Wizard, Mobile, Tablets, Modals, Print)  
**Authority:** Strict & Absolute (`UI_RULES.md` is the single source of truth for all user-facing surfaces)

---

## 1. UI Authority

1. **Single Source of Truth:** Every screen, dialog, table, input, card, status indicator, drawer, print preview, and portal view across MTJ / AVS ERP MUST strictly adhere to `UI_RULES.md`.
2. **Zero Unapproved Alterations:** No developer, subagent, or contributor may introduce arbitrary colors, fonts, spacing, shadows, radii, or visual identities without explicit owner approval.
3. **Rejection Mandate:** Any pull request, commit, or patch introducing unapproved styling, one-off hex codes, arbitrary font families, or foreign component libraries shall be **REJECTED**.

---

## 2. Approved Color Tokens

The visual identity of MTJ / AVS ERP is founded on high-density operational clarity, warm parchment/slate surfaces, a single clear action accent, and subtle AVS gold accents for brand elements and gold-weight highlights.

### A. Core Semantic Palette
| Token / Name | Light Mode (HEX / CSS) | Dark Mode (HEX / CSS) | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **`--avs-canvas`** | `#FFFFFF` | `#1E293B` (slate-800) | Primary card and table row surfaces |
| **`--avs-parchment`** | `#F8FAFC` (slate-50) | `#0F172A` (slate-900) | Main application background |
| **`--avs-obsidian`** | `#18181B` (zinc-900) | `#020617` (slate-950) | Host shell, sidebar, and high-contrast headers |
| **`--avs-line`** | `#E2E8F0` (slate-200) | `#334155` (slate-700) | Structural card, table, and panel borders |
| **`--avs-line-soft`** | `#F1F5F9` (slate-100) | `#1E293B` (slate-800) | Table row dividers, inner field separators |
| **`--avs-ink`** | `#0F172A` (slate-900) | `#F8FAFC` (slate-50) | Primary text, titles, prominent numeric headers |
| **`--avs-ink-muted`** | `#64748B` (slate-500) | `#94A3B8` (slate-400) | Secondary text, field labels, timestamps |
| **`--avs-ink-subtle`** | `#94A3B8` (slate-400) | `#64748B` (slate-500) | Placeholder text, disabled labels |

### B. Brand & Action Tokens
| Token / Name | Light Mode | Dark Mode | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **`--avs-gold`** | `#A88445` | `#C9A227` | Brand insignia, active gold highlights, badge borders |
| **`--avs-gold-soft`** | `#EEE5D2` | `rgba(201, 162, 39, 0.15)` | Gold value badges, vault balance panel backgrounds |
| **`--avs-gold-deep`** | `#806738` | `#E8C96A` | High-contrast gold labels and fine weight figures |
| **`--avs-action`** | `#0066CC` | `#2997FF` | Primary action buttons, active tabs, focus rings |
| **`--avs-action-hover`**| `#0071E3` | `#4DABFF` | Interactive button and link hover state |

### C. Status & Telemetry Tokens
| Status | Token | Light Value | Dark Value | Approved Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `status-success` | `#10B981` (emerald-500) | `#34D399` (emerald-400) | Paid invoices, settled jobs, vault in balance |
| **Warning** | `status-warning` | `#F59E0B` (amber-500) | `#FBBF24` (amber-400) | Partial settlements, pending approvals, over-loss |
| **Error** | `status-error` | `#EF4444` (red-500) | `#F87171` (red-400) | Unpaid balances, validation errors, host offline |
| **Info** | `status-info` | `#3B82F6` (blue-500) | `#60A5FA` (blue-400) | System notices, informational badges |

---

## 3. Typography

The typography system guarantees legibility for high-density accounting and tabular data.

1. **Font Families:**
   - **Primary Display & Body:** `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
   - **Financial / Weights / Codes (Monospace):** `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
2. **Hierarchy Scale:**
   - **Page Title (`h1`):** `text-2xl` to `text-3xl` (`24px`–`30px`), `font-bold` / `font-serif`
   - **Section Header (`h2`):** `text-lg` to `text-xl` (`18px`–`20px`), `font-semibold`
   - **Sub-header (`h3`):** `text-base` (`16px`), `font-medium`
   - **Body Text:** `text-sm` (`14px`), `font-normal`, `leading-normal`
   - **Labels / Captions:** `text-xs` (`12px`) or `text-[11px]`, `font-medium`, `text-muted-foreground`
   - **Numeric / Weights:** `text-sm` or `text-base`, `font-mono`, `font-semibold`

---

## 4. Spacing

All padding, margins, and gaps must follow the **8px Base Metric Scale**:

| Token | Pixels | Rem Equivalent | Common Application |
| :--- | :--- | :--- | :--- |
| `--space-1` | `4px` | `0.25rem` | Badge padding, micro button gaps, inline icons |
| `--space-2` | `8px` | `0.5rem` | Standard input inner padding (y), compact gaps |
| `--space-3` | `12px` | `0.75rem` | Standard input inner padding (x), table cell padding |
| `--space-4` | `16px` | `1.0rem` | Card padding (compact), form field vertical gaps |
| `--space-5` | `20px` | `1.25rem` | Standard card inner padding, dialog padding |
| `--space-6` | `24px` | `1.5rem` | Page section spacing, layout margins |
| `--space-8` | `32px` | `2.0rem` | Major dashboard grid gaps, modal gutters |
| `--space-10`| `40px` | `2.5rem` | Page top/bottom gutters |

---

## 5. Layout Grid & Structural Framework

1. **Dashboard Grid:** Responsive 12-column grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).
2. **Standard Page Container:**
   - Max width constraint: `max-w-7xl mx-auto` or `w-full` for dense ledger views.
   - Horizontal page padding: `px-4 sm:px-6 lg:px-8`.
   - Vertical page padding: `py-6`.
3. **Split Panes (Master-Detail):** Fixed 300px–360px navigation pane + flexible 1fr workspace.

---

## 6. Buttons

All buttons must use the central component [`src/components/ui/button.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/button.tsx).

| Variant | Purpose | Visual Appearance |
| :--- | :--- | :--- |
| **`default`** | Primary submission, save, issue job | Blue Action (`bg-primary text-primary-foreground hover:bg-primary/90`) |
| **`gold` / `primary-gold`** | Core ERP Gold actions (Submit Bill, Settle) | AVS Gold (`bg-[#A88445] text-white hover:bg-[#806738]`) |
| **`secondary`** | Non-destructive secondary actions | Neutral Slate (`bg-secondary text-secondary-foreground hover:bg-secondary/80`) |
| **`outline`** | Filters, exports, cancel, back | Bordered (`border border-input bg-background hover:bg-accent`) |
| **`ghost`** | Table row actions, icon toggles | Transparent (`hover:bg-accent hover:text-accent-foreground`) |
| **`destructive`** | Delete item, void bill, cancel job | Red Accent (`bg-destructive text-destructive-foreground hover:bg-destructive/90`) |

- **Geometry:** Height: `h-9` (default), `h-8` (sm), `h-10` (lg). Radius: `rounded-md` (`6px` / `0.375rem`).

---

## 7. Inputs

1. **Standard Input:** [`src/components/ui/input.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/input.tsx).
2. **Decimal / Weight Input:** [`src/components/ui/decimal-input.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/decimal-input.tsx).
3. **Behavioral Invariants:**
   - Must preserve exact typed keystrokes without injecting trailing zeroes while editing.
   - Text alignment: Left for descriptions, Right for numeric weights (`font-mono`).
   - Focus ring: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none`.

---

## 8. Selects & Dropdowns

1. **Standard Select:** [`src/components/ui/select.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/select.tsx) (Radix UI Select).
2. **Searchable Select / Autocomplete:** [`src/components/ui/command.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/command.tsx) (Command / Combobox).
3. **Keyboard Controls:** `Enter` to open, `ArrowUp`/`ArrowDown` to navigate, `Enter` to select, `Esc` to dismiss.

---

## 9. Tables & Data Grids

1. **Component:** [`src/components/ui/table.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/table.tsx).
2. **Header Styling:** `bg-muted/50 font-semibold text-xs uppercase tracking-wider text-muted-foreground`.
3. **Row Interactions:** `hover:bg-muted/50 transition-colors border-b border-border/60`.
4. **Column Alignments:**
   - Text / Names / Categories: **Left-aligned**.
   - Dates / Codes / HUID: **Center-aligned**.
   - Gross Wt / Less / Net Wt / Fine Wt / Currency: **Right-aligned** with `font-mono`.

---

## 10. Cards & Panels

1. **Component:** [`src/components/ui/card.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/card.tsx) & [`src/components/design-system/Panel.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/design-system/Panel.tsx).
2. **Structure:** `CardHeader` $\rightarrow$ `CardTitle` + `CardDescription` $\rightarrow$ `CardContent` $\rightarrow$ `CardFooter`.
3. **Borders & Radii:** `rounded-lg border border-border bg-card text-card-foreground shadow-sm`.

---

## 11. Tabs

1. **Component:** [`src/components/ui/tabs.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/tabs.tsx).
2. **Variants:**
   - **Pill Tabs (Default):** `bg-muted p-1 rounded-md text-muted-foreground`.
   - **Underline Tabs (Reports/Settings):** `border-b border-border pb-px`.

---

## 12. Badges & Status Indicators

1. **Component:** [`src/components/ui/badge.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/badge.tsx) & [`src/components/design-system/StatusBadge.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/design-system/StatusBadge.tsx).
2. **Status Variants:**
   - **Issued / In Progress:** `bg-blue-500/10 text-blue-500 border-blue-500/20`.
   - **Completed / Paid / Settled:** `bg-emerald-500/10 text-emerald-500 border-emerald-500/20`.
   - **Partial / Pending:** `bg-amber-500/10 text-amber-500 border-amber-500/20`.
   - **Over-loss / Void / Unpaid:** `bg-rose-500/10 text-rose-500 border-rose-500/20`.

---

## 13. Modals & Drawers

1. **Standard Modal:** [`src/components/ui/dialog.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/dialog.tsx).
2. **Side Drawer:** [`src/components/ui/sheet.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/sheet.tsx).
3. **Confirmation Dialog:** [`src/components/ui/alert-dialog.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/alert-dialog.tsx).
4. **Overlay Backdrop:** `fixed inset-0 z-50 bg-black/80 backdrop-blur-sm`.

---

## 14. Notifications & Toasts

1. **Toast Engine:** [`src/components/ui/sonner.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/sonner.tsx) (`sonner`).
2. **Positioning:** `top-center` (desktop and mobile).
3. **Severity:** `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`.

---

## 15. Loading, Empty, and Error States

1. **Loading Skeletons:** [`src/components/ui/skeleton.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/skeleton.tsx). Skeletons must mirror target card/table dimensions.
2. **Empty States:** Neutral card with icon, clear title, explanatory paragraph, and primary CTA.
3. **Error Boundaries:** [`src/components/app-error-boundary.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/app-error-boundary.tsx) providing structured error message and "Try Again" retry action.

---

## 16. Navigation System

1. **Sidebar Navigation:** [`src/components/layout/Sidebar.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/layout/Sidebar.tsx).
   - Authoritative hierarchy defined in [`src/lib/navigation-groups.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/navigation-groups.ts).
   - Dynamic portal group filtering based on `useInstallationConfig`.
2. **Mobile Navigation:** Bottom navigation bar for mobile touch screens (`/mobile/*` & portals).
3. **Command Palette:** Global keyboard search (`Ctrl+K` / `Cmd+K`) for rapid screen navigation.

---

## 17. Icons

1. **Authoritative Icon Library:** **`lucide-react`** exclusively.
2. **Icon Styling:** Stroke width: `1.75px` or `2px`, default dimensions: `w-4 h-4` (inline) or `w-5 h-5` (navigation).
3. **Prohibition:** No raw emojis in UI buttons, no mixing of FontAwesome, Heroicons, or Feather.

---

## 18. Forms & Data Entry

1. **Field Structure:** Label (`Label` / `text-xs font-medium`) + Input (`Input`) + Helper/Error message.
2. **Keyboard Traversal:** Logical `tabindex` order from top-left to bottom-right; `Enter` inside form rows moves to the next field.
3. **Validation Errors:** High-contrast red outline (`border-destructive`) with text message below the input field.

---

## 19. Gold & Financial Numeric Display

To ensure complete accounting truth across the application:

1. **Gold Weight Displays:** Must use [`src/components/ui/GoldWeightDisplay.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/GoldWeightDisplay.tsx).
   - Exactly **3 decimal places** (e.g. `15.200 g`).
   - Format: `font-mono font-semibold`.
2. **Fine Gold Values:** Distinct amber/gold font tint (`text-amber-500` / `text-[#A88445]`).
3. **Currency Displays:** Must use [`src/components/ui/MoneyDisplay.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/ui/MoneyDisplay.tsx).
   - Indian Rupee symbol: `₹`.
   - Formatted in lakhs/crores notation (`₹1,24,465.20`).

---

## 20. Responsive, Mobile, and Tablet Rules

1. **Breakpoints:**
   - Mobile: `< 640px` (`sm`)
   - Tablet / iPad: `640px` – `1024px` (`md` / `lg`)
   - Desktop: `> 1024px` (`xl`)
2. **Touch Targets:** Minimum touch height: `44px` (`--touch-target: 2.75rem`) for all buttons and interactive items.
3. **Mobile Tables:** Convert wide tabular views to responsive stacked cards on viewports $< 640\text{px}$.

---

## 21. Electron Desktop Host Shell Rules

1. **Visual Consistency:** The Electron container uses the identical dark-gold theme (`#020617` background, `#0F172A` panels).
2. **Host Control Dashboard:** [`electron-app/control-center.html`](file:///c:/final%20erp%2029.08/new%20and%20final/electron-app/control-center.html) conforms to the exact approved design tokens.
3. **Offline State Screen:**
   ```text
   ERP OFFLINE

   The shop server is currently offline.
   Please start the MTJ ERP application on the main shop PC.
   ```

---

## 22. First-Time Setup Wizard Rules

1. **Component:** [`src/routes/setup.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/setup.tsx).
2. **Aesthetic:** Dark-slate surface with gold progress stepper (`1. Business Profile` $\rightarrow$ `2. Deployment Mode` $\rightarrow$ `3. Active Portals` $\rightarrow$ `4. Tunnel Config` $\rightarrow$ `5. Admin Setup`).
3. **Zero Third-Party Installer Themes:** No generic grey installer boxes.

---

## 23. Authenticated Portals Visual Consistency

1. **Unified Identity:** Customer Portal, Karigar Portal, and Supplier Portal share the EXACT color palette, typography, button variants, and card styling as the core ERP.
2. **Role Tailoring:** Portals simplify information architecture for their specific audience without altering design tokens.

---

## 24. Print & Document Preview UI Rules

1. **Preview Modal:** [`src/components/print/PrintPreviewModal.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/print/PrintPreviewModal.tsx).
2. **Controls Toolbar:** Positioned at top header with high-contrast Action buttons (Print, Download PDF, Close).
3. **Document Canvas:** Pure `#FFFFFF` background with crisp black text (`#000000`) and exact per-millimeter alignment (`A4`, `A5`, `Thermal`).

---

## 25. Accessibility & Keyboard Governance

1. **Focus Ring:** `2px solid var(--avs-action)` with `2px` offset.
2. **Shortcuts:** Universal keymap (`Ctrl+K` command palette, `Alt+N` new invoice, `Alt+S` save, `Esc` dismiss modal).
3. **Color Contrast:** Minimum WCAG AA 4.5:1 ratio for all body and tabular text.

---

## 26. Business Customization Boundaries

### Allowed Customizations (Shop Settings)
- Firm Trade Name & Tagline
- Firm Logo Image (uploaded to storage)
- Address, GSTIN, BIS Hallmark License Number
- Thermal / Barcode tag size selection

### STRICTLY PROHIBITED Customizations (Cannot Be Overridden)
- Base color tokens and palette hierarchy
- Typography scale and font families
- Button radius, padding, and core component geometry
- Layout navigation framework

---

## 27. Forbidden UI Patterns (Automatic Rejection)

The following patterns are **strictly prohibited** across the codebase:
- ❌ Hardcoded inline hex colors (e.g. `style={{ color: '#ff0055' }}`) bypassing CSS variables.
- ❌ External or random CSS frameworks (Bootstrap, Material UI, Bulma).
- ❌ Arbitrary gradients that distract from operational data.
- ❌ Unapproved icon libraries (FontAwesome, Material Icons, raw emojis in controls).
- ❌ Non-monospace font for weights, rates, currency, or SKUs.
- ❌ Floating point number formatting without fixed decimal bounds.

---

## 28. Pull Request & Code Review Checklist

Before any code modification is merged, verify:
- [ ] 1. All colors utilize approved tokens or Tailwind semantic utilities (`bg-card`, `text-primary`, `border-border`, etc.).
- [ ] 2. Typography uses standard hierarchy (`text-sm`, `text-xs`, `font-mono` for weights).
- [ ] 3. Buttons utilize `Button` from `@/components/ui/button`.
- [ ] 4. Inputs utilize `Input` or `DecimalInput`.
- [ ] 5. Tables utilize `@/components/ui/table` with right-aligned numeric columns.
- [ ] 6. All icons are imported from `lucide-react`.
- [ ] 7. Mobile viewports tested for responsiveness ($< 640\text{px}$).
- [ ] 8. Keyboard accessibility (`Tab`, `Enter`, `Esc`) tested.
- [ ] 9. Automated check `node scripts/check-ui-rules.mjs` passes with **0 errors**.

---

## 29. Change-Control Rule

`UI_RULES.md` may only be modified with explicit written instruction from the System Owner. Any change without authorization is void.
