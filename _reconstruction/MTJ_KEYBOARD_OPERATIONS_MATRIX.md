# MTJ ERP — Keyboard Operations Matrix

**Version**: 1.1.1  
**Date**: 2026-08-31  
**Status**: PRODUCTION BASELINE  
**Reference**: `https://maatarajewellers.shop`

---

## 1. Global Navigation Shortcuts

| Shortcut | Action | Screen Scope | Notes |
|:---|:---|:---|:---|
| `Alt+H` | Go to Home / Dashboard | Global | All screens |
| `Alt+N` | New Invoice / Bill | Global | Opens `/billing/new` |
| `Alt+O` | New Order | Global | Opens `/orders/new` |
| `Alt+C` | New Customer / Account | Global | Opens account creation dialog |
| `Alt+S` | Save / Submit current form | Global | Context-sensitive |
| `Alt+P` | Print / Preview current document | Global | Opens print modal in-window |
| `Alt+F` | Find / Search | Global | Focuses search bar |
| `Alt+L` | Open Ledger for current party | Party-context | Available when party is selected |
| `Alt+R` | Go to Reports | Global | Opens `/reports` |
| `Alt+W` | Go to Workshop / Karigar | Global | Opens `/workshop` |
| `Alt+G` | Go to Gold Book / Stock | Global | Opens `/reports/gold-ledger` |
| `Escape` | Close modal / Cancel dialog | Global | All modals, dialogs, dropdowns |
| `Ctrl+Z` | Undo last field change | Form | Where undo is supported |
| `Ctrl+Enter` | Submit / Save form | Form | Equivalent to Save button |
| `F2` | Edit current record | List/Table | When a record is focused |
| `F5` | Refresh current view | Global | Reload data from cloud |

---

## 2. Form Navigation

### Standard Tab Order

All forms implement logical tab order following the visual layout:

```
FIELD 1 [Tab] → FIELD 2 [Tab] → FIELD 3 [Tab] → ... → SUBMIT BUTTON
SHIFT+Tab → Move backward through fields
Enter → In text/number fields: advance to next field
Enter → On buttons: activate button
Escape → Cancel / Close dialog
```

### Date Fields
| Key | Action |
|:---|:---|
| `Tab` | Focus the date field |
| `↑ / ↓` | Increment/decrement selected date unit (day/month/year) |
| `←/ →` | Move between day/month/year segments |
| `T` | Jump to Today |
| `Enter` | Confirm date |
| `Escape` | Close date picker |

### Numeric Fields (Weight, Amount, Rate)
| Key | Action |
|:---|:---|
| `Tab` | Advance to next numeric field; auto-calculate dependents |
| `↑ / ↓` | Increment/decrement by step (e.g. 0.001g for weight) |
| `Home` | Set to minimum value |
| `End` | Set to maximum configured value |
| `Enter` | Confirm entry and move to next field |

---

## 3. Dropdown / Combobox Keyboard Behaviour

| Key | Action |
|:---|:---|
| `Tab` | Focus the dropdown |
| `Enter` | Open options list |
| `↑ / ↓` | Move through options |
| `Home` | Jump to first option |
| `End` | Jump to last option |
| `Page Up` | Move up by 5 options |
| `Page Down` | Move down by 5 options |
| `Enter` | Select highlighted option |
| `Escape` | Close without selecting |
| Character keys | Type to filter / search options |

**Note**: Every dropdown in the ERP (Customer selector, Item selector, Payment Mode, Purity selector) implements this behaviour. Mouse interaction is NOT required.

---

## 4. Billing / POS Keyboard Flow

### Complete Keyboard Billing Sequence

```
1. Open Billing Screen
   → Alt+N (New Invoice)
   
2. Customer Selection
   → Customer field is auto-focused
   → Type customer name or mobile number
   → ↓ Arrow to move through autocomplete suggestions
   → Enter to select customer
   
3. Billing Date
   → Tab (auto-focused to date)
   → Date is pre-filled to today; Tab to advance
   
4. Add Line Item
   → Tab to Item field
   → Type item name / SKU / tag number
   → ↓ Arrow to select from suggestions
   → Enter to confirm item
   
5. Gross Weight
   → Tab → Gross Weight field focused
   → Type weight (e.g. "10.500")
   → Tab → Less Weight field
   
6. Less Weight
   → Type less weight (e.g. "0.350")
   → Tab → Net Weight auto-calculated and displayed
   
7. Purity / Tunch
   → Tab → Purity field (dropdown)
   → Enter → Opens purity options
   → ↓ Arrow to 916 / 750 / etc.
   → Enter → Select purity
   
8. Wastage %
   → Tab → Wastage field
   → Type wastage percentage
   → Tab → Hisab auto-calculated (Tunch + Wastage)
   
9. Rate
   → Tab → Rate field
   → Type or confirm live rate
   → Tab → Gold Value auto-calculated (Net × Purity × Rate)
   
10. Making / Labour
    → Tab → Making Charge field
    → Type amount or percentage
    → Tab → Line Total auto-calculated
    
11. Add Another Item
    → Enter OR Alt+A → Add new line
    → Repeat steps 4–10
    
12. Payment Mode
    → Tab to Payment Section
    → Payment Mode is GOLD by default
    → To change: Enter → Opens payment mode dropdown
    → ↓ Arrow to CASH / MIXED / UDHAR
    → Enter → Select mode
    
13. Gold Payment (Default)
    → Tab to Gold Weight field
    → Type gold weight being paid
    → Tab → Outstanding balance auto-calculated
    
14. Cash Payment (if selected)
    → Tab to Cash Amount field
    → System auto-displays: Gold Rate Used, Gold Equivalent
    → Type cash amount
    
15. Save Invoice
    → Alt+S OR Ctrl+Enter → Save invoice
    → Confirmation dialog appears
    → Enter → Confirm
    
16. Print
    → Alt+P → Opens print preview in-window
    → Tab to Print button → Enter → Print
    → Tab to PDF button → Enter → Download PDF
    → Escape → Close print preview
```

---

## 5. Table / List Navigation

| Key | Action |
|:---|:---|
| `↑ / ↓` | Move between rows |
| `←/ →` | Move between columns (where applicable) |
| `Enter` | Open/expand selected row |
| `Space` | Toggle selection (where applicable) |
| `Home` | Jump to first row |
| `End` | Jump to last row |
| `Page Up` | Previous page |
| `Page Down` | Next page |
| `F2` | Edit selected row inline (where supported) |
| `Delete` | Mark row for deletion (with confirmation) |

---

## 6. Modal / Dialog Keyboard Behaviour

| Key | Action |
|:---|:---|
| `Tab` | Cycle through focusable elements within modal |
| `Shift+Tab` | Reverse cycle |
| `Enter` | Activate focused button (usually primary action) |
| `Escape` | Close modal / Cancel |
| `Space` | Toggle checkbox, radio button when focused |

**No keyboard traps**: `Escape` always dismisses any modal or dropdown. Focus is returned to the triggering element on close.

---

## 7. Print Preview Keyboard Behaviour

| Key | Action |
|:---|:---|
| `Tab` | Cycle through: [Print] [Download PDF] [Share] [Close] |
| `Enter` | Activate focused button |
| `←/ →` | Navigate between pages (multi-page documents) |
| `Home` | Jump to first page |
| `End` | Jump to last page |
| `Escape` | Close print preview |

---

## 8. Module-Specific Shortcuts

### Billing Module (`/billing`)

| Shortcut | Action |
|:---|:---|
| `Alt+N` | New Invoice |
| `Alt+E` | New Estimate |
| `Alt+D` | New Delivery Challan |
| `Alt+R` | New Receipt |
| `Alt+G` | New Gold Receipt (Ghar Ka Receipt) |
| `Alt+C` | New Credit Note |
| `Alt+P` | Print current bill |
| `Alt+S` | Save current bill |
| `Ctrl+→` | Next Invoice (in browse mode) |
| `Ctrl+←` | Previous Invoice (in browse mode) |
| `F3` | Find / Search invoice by number |

### Orders Module (`/orders`)

| Shortcut | Action |
|:---|:---|
| `Alt+N` | New Order |
| `Alt+J` | Open Job Card for selected order |
| `Alt+D` | Mark as Delivered |
| `Alt+P` | Print Order Slip |
| `Ctrl+→` | Next Order |
| `Ctrl+←` | Previous Order |

### Workshop / Karigar Module (`/workshop`)

| Shortcut | Action |
|:---|:---|
| `Alt+I` | Issue Material to Karigar |
| `Alt+R` | Receive Work from Karigar |
| `Alt+A` | Mark Attendance |
| `Alt+S` | Open Settlement / Payout Screen |
| `Alt+L` | Open Karigar Ledger |
| `Alt+P` | Print Settlement / Passbook |

### Ledger / Reports Module (`/reports`, `/ledger`)

| Shortcut | Action |
|:---|:---|
| `Alt+L` | Open Ledger for party |
| `Alt+P` | Print current ledger / report |
| `Alt+E` | Export to PDF |
| `Alt+X` | Export to Excel / CSV |
| `F3` | Search / Filter |
| `Ctrl+Home` | Go to first entry |
| `Ctrl+End` | Go to last entry |
| `Page Up` | Previous period / page |
| `Page Down` | Next period / page |

---

## 9. Karigar Payout Keyboard Flow

```
1. Open Workshop → Settlement Tab
   → Alt+W → Workshop → Tab to Settlement tab → Enter
   
2. Select Worker
   → Worker list is focused
   → ↑/↓ to move between workers
   → Enter to select worker → Sidebar loads worker settlement details
   
3. Review Settlement Summary (Sidebar)
   → Sidebar shows:
     - Worker Name, Type
     - Attendance, Working Days
     - Total Work (by purity book)
     - Gross Earnings, Deductions
     - Net Payable, Closing Balance
   → No mouse needed to read summary
   
4. Settlement Mode
   → Tab to "Settle As" toggle
   → Space or Enter → Toggle GOLD / CASH
   → GOLD is default
   
5. Settlement Amount (Partial Payout)
   → Tab to Settlement Amount field
   → Type partial amount (e.g. "10" for 10g)
   → System shows: Remaining = Total Due − 10g
   
6. If CASH selected:
   → Tab to Cash Amount field
   → System auto-shows: Gold Rate Used, Gold Equivalent
   → Type cash amount
   
7. Confirm Settlement
   → Tab to [Confirm Settlement] button → Enter
   → Confirmation dialog: Enter → Confirm
   → Ledger updated automatically
   
8. Print Passbook
   → Alt+P → Settlement slip preview in-window
   → Enter → Print
```

---

## 10. Public Document / QR Flow (Keyboard)

| Key | Action |
|:---|:---|
| `Tab` | Move through: [Download PDF] [Print] [Share] [Verify] |
| `Enter` | Activate focused action |
| `Escape` | Close share panel |

---

## 11. Keyboard Accessibility Compliance

| Feature | Status | Details |
|:---|:---|:---|
| **Visible Focus Ring** | IMPLEMENTED | High-contrast focus ring on all interactive elements (`ring-2 ring-amber-500`) |
| **Logical Tab Order** | IMPLEMENTED | DOM order matches visual layout; `tabIndex` explicitly set where needed |
| **No Keyboard Traps** | IMPLEMENTED | `Escape` always exits; no infinite focus loops |
| **Dropdown Keyboard Support** | IMPLEMENTED | Full `ArrowUp/Down/Enter/Escape` on all custom dropdowns |
| **Modal Keyboard Support** | IMPLEMENTED | Focus trapped within modal; Escape closes; Tab cycles through elements |
| **Table Navigation** | IMPLEMENTED | `↑/↓` for rows, `Enter` to expand, `Page Up/Down` for pagination |
| **Date Fields** | IMPLEMENTED | `↑/↓` for segments, `T` for today, `Enter` to confirm |
| **Numeric Fields** | IMPLEMENTED | `↑/↓` for increment/decrement, `Tab` to advance and auto-calculate |
| **Search / Filter** | IMPLEMENTED | `Alt+F` focuses search; character keys filter dropdowns |
| **Print Options** | IMPLEMENTED | Full keyboard access to Preview, Print, PDF, Share in print modal |

---

## 12. Shortcuts That Must NOT Conflict

The following browser/system shortcuts are **not overridden**:

| Key | Reserved Use |
|:---|:---|
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+X` | Cut |
| `Ctrl+A` | Select All |
| `Ctrl+Z` | Browser Undo |
| `Ctrl+F` | Browser Find (not overridden; use `Alt+F` instead) |
| `Ctrl+T` | New browser tab |
| `Ctrl+W` | Close browser tab |
| `Ctrl+R` | Browser refresh |
| `F5` | Browser refresh (MTJ uses `F5` only when ERP window is focused) |
| `F11` | Fullscreen |
| `Alt+←/→` | Browser back/forward |

---

## 13. Implementation References

| Component | File | Notes |
|:---|:---|:---|
| Global keyboard shortcuts | `src/lib/keyboard-shortcuts.ts` | `useKeyboardShortcuts()` hook |
| Dropdown keyboard handler | `src/components/ui/combobox.tsx` | Full ARIA-compliant keyboard navigation |
| Modal focus trap | `src/components/ui/dialog.tsx` | Radix UI Dialog with keyboard lock |
| Table navigation | `src/components/ui/data-table.tsx` | `KeyboardEvent` handlers on `<tbody>` |
| Print modal keyboard | `src/components/PrintEngine.tsx` | Tab-cycle within print modal |
| Billing keyboard flow | `src/routes/billing.new.tsx` | Custom `handleKeyDown` on form container |
| Karigar settlement keyboard | `src/components/karigar/KarigarPeriodSettlementHub.tsx` | Settlement mode toggle + partial amount keyboard |

---

*This document is part of the MTJ ERP Production Baseline Freeze (2026-08-31).*  
*Any future keyboard behaviour changes must update this matrix before release.*
