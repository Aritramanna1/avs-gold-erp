# MTJ ERP — KEYBOARD WORKFLOW & SHORTCUT MATRIX

**Standard Reference**: `https://maatarajewellers.shop`  
**Operating Philosophy**: Keyboard-First Desktop ERP — 100% mouse-free operability for rapid jewellery counter and back-office workflows.

---

## 1. Global Navigation Keys & Universal Controls

| Key / Combination | Target Scope | Action / Behavior |
| :--- | :--- | :--- |
| **`Tab`** | All Forms & Screens | Advance focus to next focusable control in natural tab order |
| **`Shift + Tab`** | All Forms & Screens | Move focus to previous control |
| **`Enter`** | Form Inputs | Advance to next field or submit line-item into grid |
| **`Enter`** | Dropdowns / Selects | Open dropdown menu / commit selected option |
| **`Arrow Down` / `Arrow Up`** | Dropdowns / Selects | Navigate options up and down without mouse |
| **`Escape`** | Dropdowns / Modals | Close open dropdown, dialog, or drawer; cancel active search |
| **`Space`** | Buttons / Checkboxes | Toggle checkbox state, trigger button action |
| **`Home` / `End`** | Text Fields / Grids | Jump to start / end of text or first / last record |
| **`Page Up` / `Page Down`** | Grids / Registers | Paginate up / down by full page view |

---

## 2. ERP Functional Shortcut Keys

| Shortcut | Context / Module | Action |
| :--- | :--- | :--- |
| **`F2`** | Global / Billing | Focus / Trigger Barcode Scanner Input |
| **`F4`** | Billing | Toggle Customer Selection Modal / Search |
| **`F7`** | Billing / Workshop | Add Jewellery Line Item / Focus Tag Input |
| **`F8`** | Billing | Open Payment & Gold Settlement Drawer |
| **`F9`** | Forms / Invoices | Save Voucher / Finalize Transaction |
| **`F10`** | Documents / Invoices | Print Current Document / Open Spooler |
| **`Ctrl + S` / `Cmd + S`** | Master Forms / Dialogs | Quick Save Active Record |
| **`Ctrl + P` / `Cmd + P`** | Preview / Slip | Universal Print Document Dispatch |
| **`Alt + N`** | Grids / Registers | Create New Entry (e.g. New Invoice, New Customer) |
| **`Alt + S`** | Search Bars | Focus Search Input |

---

## 3. Dropdown & Search-Picker Keyboard Behavior

Every selection component in the ERP adheres strictly to the canonical desktop terminal protocol:

```
[ Focus Input / Trigger ]
         │
         ├── Enter / Space / ArrowDown ──► Opens Popup List
         │
         ├── Arrow Down ──────────────────► Highlights Next Option
         │
         ├── Arrow Up ────────────────────► Highlights Previous Option
         │
         ├── Type Characters ─────────────► Filters Options in Real-Time
         │
         ├── Enter ───────────────────────► Selects Highlighted Option & Closes
         │
         └── Escape ──────────────────────► Closes Popup Without Changing Selection
```

### Verified Components
- **`PartySearchSelect`** (`src/components/party-search-select.tsx`): Keyboard search, arrow navigation, Enter selection, Esc dismissal.
- **`Select` / `SelectTrigger`** (`src/components/ui/select.tsx`): Radix UI native keyboard primitives.
- **`TagScanInput`** (`src/components/billing/TagScanInput.tsx`): F2 scanner focus, automatic parse and advance on Enter.

---

## 4. Billing Keyboard-First Workflow

```
[Start New Bill]
  │
  ├── 1. Press Tab / F4 ────────► Search & Select Customer (Arrow keys + Enter)
  │
  ├── 2. Press Tab ─────────────► Focus Item / Barcode Field (or press F2)
  │
  ├── 3. Enter Barcode / Item ──► Press Enter (Auto-fetches Gross, Net, Purity, Making)
  │
  ├── 4. Press Tab ─────────────► Edit Gross Wt (g) -> Net Wt (g) -> Purity -> Rate
  │
  ├── 5. Press Enter ───────────► Adds line item to invoice grid
  │
  ├── 6. Press F8 ──────────────► Open Settlement Drawer
  │                                ├── Settlement Method: [GOLD] (Default) / [CASH] / [MIXED]
  │                                ├── Enter Gold Gross / Fine (g)
  │                                └── Enter Cash (₹) -> Auto-computes Gold Equiv (g)
  │
  ├── 7. Press F9 ──────────────► Finalize Invoice (Posts to Ledger & Gold Books)
  │
  └── 8. Press F10 ─────────────► Print Invoice (Universal Print Engine)
```

---

## 5. Settlement Screen Keyboard Workflow (`/settlement/$id` & `/workshop/gold-book`)

1. **Voucher Selection**: Arrow Up / Down moves across draft settlement vouchers, `Enter` opens detail view.
2. **Settlement Method Switcher**:
   - `[GOLD]` (Default): Focus enters Gold Gross weight (g), Purity selector (916/750/999), and Fine Gold auto-computes.
   - `[CASH]`: Focus enters Payment Mode (Cash, UPI, Bank) and Amount (₹). Transaction Gold Rate and Gold Equivalent (g) compute live.
   - `[MIXED]`: Both components accessible via sequential Tab navigation.
3. **Record Payment**: Pressing `Enter` on reference field or clicking button records the payment.
4. **Finalize**: Press `Alt + F` or click Finalize to complete settlement and generate invoice.

---

## 6. Table & Grid Navigation Matrix

| Context | Key Action | Verified Behavior |
| :--- | :--- | :--- |
| **Invoice Register** | `Arrow Up` / `Arrow Down` | Move row focus through recent sales invoices |
| **Invoice Register** | `Enter` | Open selected invoice detail/edit modal |
| **Karigar Ledger** | `Arrow Up` / `Arrow Down` | Move across purity-wise custody transactions |
| **Karigar Ledger** | `Page Up` / `Page Down` | Jump 20 records backward / forward |
| **Daily Rojmel** | `Home` / `End` | Jump to opening balance / closing balance row |
| **Modal Dialogs** | `Escape` | Safely close without modifying background state |

---

## 7. Compliance Statement

- **Mouse Dependency**: **0%** for primary sales, settlement, workshop entries, and printing.
- **Form Traversal**: Linear `Tab` and `Shift+Tab` cycles without dead ends or trapped focus.
- **Shortcut Collision Prevention**: All browser defaults (`Ctrl+P`, `Ctrl+S`, `F2`, `F8`, `F10`) cleanly intercepted and redirected to ERP commands.
