# MTJ / AVS ERP — UI COMPONENT INVENTORY

This document provides a comprehensive inventory of all approved user-facing UI components across the MTJ / AVS ERP system.

---

## 1. Core Primitives (`src/components/ui/`)

| Component | Source File | Purpose | Key Variants / Props | Primary Usage |
| :--- | :--- | :--- | :--- | :--- |
| **`Button`** | `src/components/ui/button.tsx` | Standard interactive button | `default`, `gold`, `secondary`, `outline`, `ghost`, `destructive` | All forms, dialogs, tables |
| **`Input`** | `src/components/ui/input.tsx` | Single-line text & alphanumeric input | Standard, disabled, focus-ring | Customer forms, filters, logins |
| **`DecimalInput`** | `src/components/ui/decimal-input.tsx` | Exact numeric & weight input | Precision decimals, no trailing zero jump | Billing weights, rates, karigar dhadi |
| **`GoldWeightDisplay`**| `src/components/ui/GoldWeightDisplay.tsx` | Formatted gold/fine gold weight | `grams`, `purity`, `showUnit`, `3 decimal places` | Ledgers, job cards, stock tags |
| **`MoneyDisplay`** | `src/components/ui/MoneyDisplay.tsx` | Formatted currency display | `paise`, `rupees`, `Indian numbering` | Invoices, payments, expense registers |
| **`Card`** | `src/components/ui/card.tsx` | Surface container for content | `CardHeader`, `CardTitle`, `CardContent` | Dashboards, summaries, wizards |
| **`Table`** | `src/components/ui/table.tsx` | High-density tabular data grid | `TableHeader`, `TableRow`, `TableCell` | All registers, ledgers, inventory |
| **`Badge`** | `src/components/ui/badge.tsx` | Status and category tags | `default`, `secondary`, `destructive`, `outline` | Status labels, role indicators |
| **`Dialog`** | `src/components/ui/dialog.tsx` | Centered modal overlay | `DialogContent`, `DialogHeader`, `DialogFooter` | New item, edit customer, payment popup |
| **`Sheet`** | `src/components/ui/sheet.tsx` | Slide-over side drawer | `top`, `bottom`, `left`, `right` | Detail inspectors, quick filters |
| **`AlertDialog`** | `src/components/ui/alert-dialog.tsx` | Modal confirmation gate | Action confirmation | Void invoice, wipeout, delete action |
| **`Select`** | `src/components/ui/select.tsx` | Accessible dropdown picker | `SelectTrigger`, `SelectContent`, `SelectItem` | Category selection, branch picker |
| **`Tabs`** | `src/components/ui/tabs.tsx` | Multi-view switcher | `TabsList`, `TabsTrigger`, `TabsContent` | Report sub-views, settings panels |
| **`Checkbox`** | `src/components/ui/checkbox.tsx` | Binary selection control | Checked, unchecked, indeterminate | Bulk table selection, portal toggles |
| **`Switch`** | `src/components/ui/switch.tsx` | Toggle switch | Active / Inactive | Settings toggles, feature switches |
| **`Command`** | `src/components/ui/command.tsx` | Command palette / combobox | Searchable list, keyboard navigation | Global search, item autocomplete |
| **`Skeleton`** | `src/components/ui/skeleton.tsx` | Loading placeholder | Animated pulse shape | Table row & card loading states |
| **`Sonner`** | `src/components/ui/sonner.tsx` | Toast notification provider | `toast.success`, `toast.error` | Background actions, save confirmation |
| **`Tooltip`** | `src/components/ui/tooltip.tsx` | Hover contextual helper | Text explanation | Icon buttons, abbreviated codes |

---

## 2. Layout & Shell Components (`src/components/layout/` & `src/components/design-system/`)

| Component | Source File | Purpose | Usage Area |
| :--- | :--- | :--- | :--- |
| **`AppShell`** | `src/components/layout/AppShell.tsx` | Master ERP application layout | All authenticated ERP routes |
| **`Sidebar`** | `src/components/layout/Sidebar.tsx` | Primary collapsible navigation bar | Desktop ERP workspace |
| **`AuthLayout`** | `src/components/layout/AuthLayout.tsx` | Unified login card container | `/login`, `/customer-login`, `/karigar-login` |
| **`AuthNativeShell`** | `src/components/layout/AuthNativeShell.tsx` | Dark-gold branded authentication shell | Desktop, mobile, and web login |
| **`PageHeader`** | `src/components/design-system/PageHeader.tsx` | Page title, breadcrumb & actions toolbar | Top of all main ERP modules |
| **`StandardPage`** | `src/components/design-system/StandardPage.tsx` | Standard layout wrapper | Standard module views |
| **`Panel`** | `src/components/design-system/Panel.tsx` | Surface panel container | Customization, settings panels |
| **`Breadcrumb`** | `src/components/design-system/Breadcrumb.tsx` | Hierarchical route breadcrumbs | Nested routes & sub-registers |
| **`StatusBadge`** | `src/components/design-system/StatusBadge.tsx` | Unified status badge with color coding | Invoice, job card, and ledger tables |
| **`TabletSplitView`** | `src/components/design-system/TabletSplitView.tsx` | Dual-pane responsive layout for tablets | Point-of-sale and catalogue |
| **`HostDownBanner`** | `src/components/network/HostDownBanner.tsx` | Host offline recovery banner | Global connection error boundary |

---

## 3. Specialized Module Components

| Component | Source File | Purpose |
| :--- | :--- | :--- |
| **`PrintPreviewModal`** | `src/components/print/PrintPreviewModal.tsx` | Universal print and PDF preview engine |
| **`GlobalCommandPalette`** | `src/components/GlobalCommandPalette.tsx` | `Ctrl+K` quick navigation and action search |
| **`SessionLockOverlay`** | `src/components/security/SessionLockOverlay.tsx` | Inactivity security screen lock |
| **`KeyboardCheatSheet`** | `src/components/keyboard/KeyboardCheatSheet.tsx` | In-app keyboard shortcut reference |
| **`DedicatedPortalLoginPage`** | `src/components/portal/DedicatedPortalLoginPage.tsx` | Authenticated portal sign-in |
| **`PortalWelcomePage`** | `src/components/portal/PortalWelcomePage.tsx` | Portal landing and dashboard |
| **`PortalMobileBottomNav`** | `src/components/portal/PortalMobileBottomNav.tsx` | Mobile navigation bar for portals |
