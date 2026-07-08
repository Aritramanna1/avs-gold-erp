/**
 * MTJ ERP — WhatsApp Templates (manual send, no API).
 *
 * Built-in templates ship with sensible Hindi/English defaults; users
 * can edit body, toggle active, and reset to default per template.
 */
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { createRepository } from "./repositories/base-repository";

const appSettingsRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "app_settings",
);

export type TemplateTarget = "customer" | "karigar" | "worker" | "owner" | "vendor";

export type TemplateKind =
  | "order_confirm"
  | "order_ready"
  | "payment_reminder"
  | "delay_update"
  | "repair_ready"
  | "job_assignment"
  | "work_reminder"
  | "gold_issue_alert"
  | "work_receive_confirm"
  | "daily_owner_summary"
  | "settlement_ready"
  | "pending_settlement"
  | "custom";

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  order_confirm: "Customer Order Confirmation",
  order_ready: "Customer Order Ready",
  payment_reminder: "Customer Payment Reminder",
  delay_update: "Customer Delay Update",
  repair_ready: "Repair Ready Message",
  job_assignment: "Karigar Job Card Assignment",
  work_reminder: "Karigar Work Reminder",
  gold_issue_alert: "Karigar Gold Issue Alert",
  work_receive_confirm: "Karigar Work Receive Confirmation",
  daily_owner_summary: "Daily Owner Summary",
  settlement_ready: "Settlement Ready for Review",
  pending_settlement: "Pending Settlement Reminder",
  custom: "Custom Message",
};

export const TEMPLATE_TARGET: Record<TemplateKind, TemplateTarget> = {
  order_confirm: "customer",
  order_ready: "customer",
  payment_reminder: "customer",
  delay_update: "customer",
  repair_ready: "customer",
  job_assignment: "karigar",
  work_reminder: "karigar",
  gold_issue_alert: "karigar",
  work_receive_confirm: "karigar",
  daily_owner_summary: "owner",
  settlement_ready: "customer",
  pending_settlement: "customer",
  custom: "customer",
};

export interface WaTemplate {
  id: string;
  kind: TemplateKind;
  name: string;
  target: TemplateTarget;
  body: string;
  active: boolean;
  isBuiltin: boolean;
}

export const DEFAULT_BODIES: Record<TemplateKind, string> = {
  order_confirm:
    "Namaste {{customer_name}} ji,\n" +
    "Aapka order confirm ho gaya hai at {{firm_name}}.\n\n" +
    "Order No: {{order_number}}\n" +
    "Item: {{item_name}} ({{category}})\n" +
    "Purity: {{purity}}\n" +
    "Estimated Weight: {{gross_weight}}\n" +
    "Delivery Date: {{delivery_date}}\n\n" +
    "Dhanyavaad.\n{{firm_name}} · {{firm_phone}}",
  order_ready:
    "Namaste {{customer_name}} ji,\n" +
    "Aapka order {{order_number}} tayyar hai.\n" +
    "Item: {{item_name}} · {{gross_weight}} · {{purity}}\n" +
    "Kripya pickup karein.\n{{firm_name}} · {{firm_phone}}",
  payment_reminder:
    "Namaste {{customer_name}} ji,\n" +
    "Invoice {{invoice_number}} ka outstanding ₹ {{outstanding_amount}} hai.\n" +
    "Due Date: {{payment_due_date}}\n" +
    "Kripya payment kar dein.\n{{firm_name}}",
  delay_update:
    "Namaste {{customer_name}} ji,\n" +
    "Order {{order_number}} mein thoda samay lag raha hai.\n" +
    "Naya expected delivery: {{delivery_date}}\n" +
    "Asuvidha ke liye khed hai.\n{{firm_name}}",
  repair_ready:
    "Namaste {{customer_name}} ji,\n" +
    "Aapki repair {{repair_number}} tayyar hai.\n" +
    "Status: {{repair_status}}\n" +
    "Kripya pickup karein.\n{{firm_name}} · {{firm_phone}}",
  job_assignment:
    "Namaste {{karigar_name}} ji,\n" +
    "Naya job assigned from {{firm_name}}.\n\n" +
    "Job Card: {{job_card_number}}\n" +
    "Order: {{order_number}}\n" +
    "Item: {{item_name}} ({{category}})\n" +
    "Purity: {{purity}}\n" +
    "Target Gross: {{gross_weight}} · Fine: {{fine_weight}}\n" +
    "Delivery Date: {{delivery_date}}\n\n" +
    "Kripya work start karke status update karein.",
  work_reminder:
    "Namaste {{karigar_name}} ji,\n" +
    "Job {{job_card_number}} ka status batayein.\n" +
    "Delivery: {{delivery_date}}",
  gold_issue_alert:
    "Namaste {{karigar_name}} ji,\n" +
    "Aapko gold issue kiya gaya hai:\n" +
    "Job: {{job_card_number}} · Order: {{order_number}}\n" +
    "Gold Issued: {{gold_issued}} fine\n" +
    "Item: {{item_name}} · Purity: {{purity}}",
  work_receive_confirm:
    "Namaste {{karigar_name}} ji,\n" +
    "Aapse work receive ho gaya:\n" +
    "Job: {{job_card_number}}\n" +
    "Gold Received: {{gold_received}} fine\n" +
    "Status: {{current_status}}\n" +
    "Dhanyavaad.",
  daily_owner_summary:
    "{{firm_name}} — Daily Summary\n" +
    "Date: {{current_status}}\n" +
    "(Open Daily Close report for full numbers.)",
  settlement_ready:
    "Namaste {{customer_name}} ji,\n" +
    "Aapka settlement {{settlement_number}} ready hai review ke liye.\n" +
    "Grand Total: {{invoice_amount}}\n" +
    "Kripya {{firm_name}} se sampark karein.\n{{firm_name}} · {{firm_phone}}",
  pending_settlement:
    "Namaste {{customer_name}} ji,\n" +
    "Aapka settlement {{settlement_number}} abhi bhi pending hai.\n" +
    "Outstanding: {{outstanding_amount}}\n" +
    "Kripya jald settlement complete karein.\n{{firm_name}} · {{firm_phone}}",
  custom: "",
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function seedTemplates(): WaTemplate[] {
  const kinds: TemplateKind[] = [
    "order_confirm",
    "order_ready",
    "payment_reminder",
    "delay_update",
    "repair_ready",
    "job_assignment",
    "work_reminder",
    "gold_issue_alert",
    "work_receive_confirm",
    "daily_owner_summary",
    "custom",
  ];
  return kinds.map((k) => ({
    id: `builtin_${k}`,
    kind: k,
    name: TEMPLATE_KIND_LABELS[k],
    target: TEMPLATE_TARGET[k],
    body: DEFAULT_BODIES[k],
    active: true,
    isBuiltin: true,
  }));
}

interface WaTemplateState {
  templates: WaTemplate[];
  refresh: () => Promise<void>;
  add: (t: Omit<WaTemplate, "id" | "isBuiltin">) => Promise<WaTemplate>;
  update: (
    id: string,
    patch: Partial<Omit<WaTemplate, "id" | "isBuiltin" | "kind">>,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  resetToDefault: (id: string) => Promise<void>;
  resetAll: () => Promise<void>;
}

export const useWaTemplates = create<WaTemplateState>()((set, get) => {
  const saveState = async (templates: WaTemplate[]) => {
    await appSettingsRepository.saveAs("whatsapp_templates", { templates });
    set({ templates });
  };

  return {
    templates: [],

    refresh: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("data")
        .eq("id", "whatsapp_templates")
        .maybeSingle();

      if (error) {
        console.error("Error fetching whatsapp_templates:", error);
        return;
      }
      if (data && data.data) {
        const payload = data.data as any;
        set({ templates: payload.templates || [] });
      } else {
        set({ templates: seedTemplates() });
      }
    },

    add: async (input) => {
      const t: WaTemplate = { ...input, id: makeId(), isBuiltin: false };
      const templates = [...get().templates, t];
      await saveState(templates);
      return t;
    },
    update: async (id, patch) => {
      const templates = get().templates.map((t) => (t.id === id ? { ...t, ...patch } : t));
      await saveState(templates);
    },
    remove: async (id) => {
      const t = get().templates.find((x) => x.id === id);
      if (!t || t.isBuiltin) return; // can't delete builtins
      const templates = get().templates.filter((x) => x.id !== id);
      await saveState(templates);
    },
    resetToDefault: async (id) => {
      const t = get().templates.find((x) => x.id === id);
      if (!t || !t.isBuiltin) return;
      const templates = get().templates.map((x) =>
        x.id === id ? { ...x, body: DEFAULT_BODIES[x.kind], active: true } : x,
      );
      await saveState(templates);
    },
    resetAll: async () => {
      const templates = seedTemplates();
      await saveState(templates);
    },
  };
});
