/**
 * Configurable Keyboard Shortcuts & Power-User Input Store
 * Master Reference: docs/KEYBOARD_AND_INPUT_MASTER.md
 * Master Reference: docs/ADAPTIVE_UI_MASTER.md
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { normalizeKeyCombo } from "@/lib/keyboard/normalize-combo";

export interface ShortcutDefinition {
  id: string;
  name: string;
  category:
    | "Navigation"
    | "Sales & Billing"
    | "Workshop & Metal"
    | "Accounts & Stock"
    | "System Tools"
    | "Billing POS"
    | "Forms";
  defaultKeys: string;
  customKeys: string | null;
  routeTarget?: string;
  action?: "navigate" | "command_palette" | "cheat_sheet" | "assistant" | "history_back";
  description: string;
  isSystemProtected?: boolean;
}

export interface PowerUserSettings {
  autoAdvanceGridOnEnter: boolean;
  stickyRapidActionBar: boolean;
  numpadQuickOperators: boolean;
  barcodeAutoSubmit: boolean;
  scaleStreamingAutocapture: boolean;
  presetProfile: "standard" | "tally_like" | "jwelly_like" | "custom";
}

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // Navigation
  {
    id: "nav_command_palette",
    name: "Open Command Palette & Search",
    category: "Navigation",
    defaultKeys: "Ctrl+K",
    customKeys: null,
    action: "command_palette",
    description: "Global instant jump search across all ERP screens and records",
    isSystemProtected: true,
  },
  {
    id: "nav_home",
    name: "Go to Home / Dashboard",
    category: "Navigation",
    defaultKeys: "Alt+H",
    customKeys: null,
    action: "navigate",
    routeTarget: "/",
    description: "Navigate to main overview dashboard",
  },
  {
    id: "nav_assistant_quick",
    name: "Open AI Assistant (Quick)",
    category: "Navigation",
    defaultKeys: "Ctrl+J",
    customKeys: null,
    action: "assistant",
    description: "Toggle Ornexa assistant drawer from anywhere",
  },
  {
    id: "nav_assistant",
    name: "Open AI Assistant (Alt)",
    category: "Navigation",
    defaultKeys: "Ctrl+Shift+A",
    customKeys: null,
    action: "assistant",
    description: "Open Ornexa AI assistant drawer",
  },
  {
    id: "nav_help",
    name: "Keyboard Cheat Sheet Modal",
    category: "Navigation",
    defaultKeys: "Ctrl+/",
    customKeys: null,
    action: "cheat_sheet",
    description: "Display all active hotkeys in a lightweight overlay",
  },
  {
    id: "nav_back",
    name: "Go Back",
    category: "Navigation",
    defaultKeys: "Alt+Left",
    customKeys: null,
    action: "history_back",
    description: "Return to previous screen",
  },
  {
    id: "nav_people",
    name: "People / KYC",
    category: "Navigation",
    defaultKeys: "Alt+P",
    customKeys: null,
    action: "navigate",
    routeTarget: "/people",
    description: "Customers, suppliers, karigars, and KYC",
  },
  {
    id: "nav_reports",
    name: "Reports Hub",
    category: "Navigation",
    defaultKeys: "Alt+R",
    customKeys: null,
    action: "navigate",
    routeTarget: "/reports",
    description: "Operational and financial reports",
  },

  {
    id: "nav_find",
    name: "Find / Search Records",
    category: "Navigation",
    defaultKeys: "Ctrl+F",
    customKeys: null,
    action: "command_palette",
    description: "Open global search (same as command palette)",
  },

  // Billing POS (configurable F-keys)
  {
    id: "bill_f2_scan",
    name: "Billing — Focus Barcode Scan",
    category: "Billing POS",
    defaultKeys: "F2",
    customKeys: null,
    description: "Focus barcode / HUID scan field on invoice screen",
  },
  {
    id: "bill_f4_customer",
    name: "Billing — Focus Customer",
    category: "Billing POS",
    defaultKeys: "F4",
    customKeys: null,
    description: "Focus customer search on invoice screen",
  },
  {
    id: "bill_f7_order",
    name: "Billing — Focus Order",
    category: "Billing POS",
    defaultKeys: "F7",
    customKeys: null,
    description: "Focus order reference on invoice screen",
  },
  {
    id: "bill_f8_add_line",
    name: "Billing — Add Line Item",
    category: "Billing POS",
    defaultKeys: "F8",
    customKeys: null,
    description: "Add a new invoice line item",
  },
  {
    id: "bill_f9_payment",
    name: "Billing — Add Payment Row",
    category: "Billing POS",
    defaultKeys: "F9",
    customKeys: null,
    description: "Add payment / receipt row on invoice",
  },
  {
    id: "bill_f10_save",
    name: "Billing — Save & Print",
    category: "Billing POS",
    defaultKeys: "F10",
    customKeys: null,
    description: "Confirm invoice and open print flow",
  },
  {
    id: "bill_save_enter",
    name: "Billing — Confirm (Modifier+Enter)",
    category: "Billing POS",
    defaultKeys: "Ctrl+Enter",
    customKeys: null,
    description: "Save and confirm current invoice",
  },

  // Forms
  {
    id: "form_save",
    name: "Save Draft / Form",
    category: "Forms",
    defaultKeys: "Ctrl+S",
    customKeys: null,
    description: "Save the active form or dialog",
  },
  {
    id: "form_escape",
    name: "Cancel / Close",
    category: "Forms",
    defaultKeys: "Escape",
    customKeys: null,
    description: "Close modal or cancel inline edit (native in most dialogs)",
    isSystemProtected: true,
  },

  // Sales & Billing
  {
    id: "bill_new_invoice",
    name: "New Sales Invoice",
    category: "Sales & Billing",
    defaultKeys: "Alt+N",
    customKeys: null,
    action: "navigate",
    routeTarget: "/billing/new",
    description: "Open blank POS sales invoice creator",
  },
  {
    id: "bill_billing_hub",
    name: "Billing Hub",
    category: "Sales & Billing",
    defaultKeys: "Alt+B",
    customKeys: null,
    action: "navigate",
    routeTarget: "/billing",
    description: "Invoices, receipts, and payments",
  },
  {
    id: "bill_ready_stock",
    name: "Showroom Ready Stock",
    category: "Sales & Billing",
    defaultKeys: "Alt+S",
    customKeys: null,
    action: "navigate",
    routeTarget: "/stock",
    description: "View tagged inventory and counter display trays",
  },
  {
    id: "bill_orders",
    name: "Custom Customer Orders",
    category: "Sales & Billing",
    defaultKeys: "Alt+O",
    customKeys: null,
    action: "navigate",
    routeTarget: "/orders",
    description: "Browse bespoke booking orders and delivery status",
  },

  // Workshop & Metal
  {
    id: "ws_karigar_book",
    name: "Worker Gold Book",
    category: "Workshop & Metal",
    defaultKeys: "Alt+W",
    customKeys: null,
    action: "navigate",
    routeTarget: "/workshop/gold-book",
    description: "Artisan metal custody and pure fine balance register",
  },
  {
    id: "ws_mfg_books",
    name: "Manufacturing Books Hub",
    category: "Workshop & Metal",
    defaultKeys: "Alt+M",
    customKeys: null,
    action: "navigate",
    routeTarget: "/workshop",
    description: "Job cards, casting, setting, and polishing workflows",
  },
  {
    id: "ws_metal_conversion",
    name: "Metal Conversion & Melting",
    category: "Workshop & Metal",
    defaultKeys: "Alt+C",
    customKeys: null,
    action: "navigate",
    routeTarget: "/conversion",
    description: "Vault melting, purity assaying, and alloy conversions",
  },

  // Accounts & Stock
  {
    id: "acc_chart_accounts",
    name: "Chart of Accounts & Period Control",
    category: "Accounts & Stock",
    defaultKeys: "Alt+A",
    customKeys: null,
    action: "navigate",
    routeTarget: "/control/accounts",
    description: "Dual cash/metal ledgers, account groups, and day close",
  },
  {
    id: "acc_gold_ledger",
    name: "Vault Gold Stock Register",
    category: "Accounts & Stock",
    defaultKeys: "Alt+G",
    customKeys: null,
    action: "navigate",
    routeTarget: "/ledger",
    description: "Physical bullion and fine gold ledger transactions",
  },
  {
    id: "acc_expenses",
    name: "Expenses & Cash Vouchers",
    category: "Accounts & Stock",
    defaultKeys: "Alt+E",
    customKeys: null,
    action: "navigate",
    routeTarget: "/expenses",
    description: "Voucher expense registry with GST input split",
  },

  // System Tools
  {
    id: "sys_shortcuts",
    name: "Keyboard & Shortcuts Settings",
    category: "System Tools",
    defaultKeys: "Ctrl+Shift+K",
    customKeys: null,
    action: "navigate",
    routeTarget: "/control/shortcuts",
    description: "Customize hotkeys and power-user ergonomics",
  },
  {
    id: "sys_customization",
    name: "Universal Customization Hub",
    category: "System Tools",
    defaultKeys: "Ctrl+Shift+C",
    customKeys: null,
    action: "navigate",
    routeTarget: "/control/customization",
    description: "Entities, Books, Rules, and Transaction Types Designer",
  },
  {
    id: "sys_settings",
    name: "ERP Settings & Config",
    category: "System Tools",
    defaultKeys: "Ctrl+,",
    customKeys: null,
    action: "navigate",
    routeTarget: "/settings",
    description: "Tenant profile, rate book, hardware, and backup controls",
  },
];

interface ShortcutsState {
  shortcuts: ShortcutDefinition[];
  powerUser: PowerUserSettings;

  // Actions
  updateShortcut: (id: string, keys: string | null) => void;
  resetShortcut: (id: string) => void;
  restoreAllDefaults: () => void;
  setPresetProfile: (profile: PowerUserSettings["presetProfile"]) => void;
  updatePowerUserSettings: (patch: Partial<PowerUserSettings>) => void;
}

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set, get) => ({
      shortcuts: DEFAULT_SHORTCUTS,
      powerUser: {
        autoAdvanceGridOnEnter: true,
        stickyRapidActionBar: true,
        numpadQuickOperators: true,
        barcodeAutoSubmit: true,
        scaleStreamingAutocapture: true,
        presetProfile: "standard",
      },

      updateShortcut: (id, keys) => {
        // Validate collision
        if (keys) {
          const currentList = get().shortcuts;
          const collision = currentList.find(
            (s) =>
              s.id !== id &&
              normalizeKeyCombo(s.customKeys || s.defaultKeys) === normalizeKeyCombo(keys),
          );
          if (collision) {
            toast.warning(`Shortcut "${keys}" is already mapped to "${collision.name}".`);
          }
        }

        set((state) => ({
          shortcuts: state.shortcuts.map((s) => (s.id === id ? { ...s, customKeys: keys } : s)),
        }));
        toast.success("Shortcut keybinding updated.");
      },

      resetShortcut: (id) => {
        set((state) => ({
          shortcuts: state.shortcuts.map((s) => (s.id === id ? { ...s, customKeys: null } : s)),
        }));
        toast.success("Shortcut restored to default.");
      },

      restoreAllDefaults: () => {
        set(() => ({
          shortcuts: DEFAULT_SHORTCUTS,
          powerUser: {
            autoAdvanceGridOnEnter: true,
            stickyRapidActionBar: true,
            numpadQuickOperators: true,
            barcodeAutoSubmit: true,
            scaleStreamingAutocapture: true,
            presetProfile: "standard",
          },
        }));
        toast.success(
          "All keyboard shortcuts and power-user ergonomics restored to factory defaults.",
        );
      },

      setPresetProfile: (profile) => {
        set((state) => ({
          powerUser: {
            ...state.powerUser,
            presetProfile: profile,
          },
        }));
        toast.success(`Applied ${profile.replace("_", " ").toUpperCase()} shortcut profile.`);
      },

      updatePowerUserSettings: (patch) => {
        set((state) => ({
          powerUser: {
            ...state.powerUser,
            ...patch,
          },
        }));
        toast.success("Power-user ergonomics updated.");
      },
    }),
    {
      name: "ornexa-keyboard-shortcuts-store",
    },
  ),
);
