/**
 * MTJ ERP — WhatsApp Ingestion (manual paste, no API)
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";

export type WhatsappStatus = "pending" | "parsed" | "converted" | "ignored";

export const WA_STATUS_LABELS: Record<WhatsappStatus, string> = {
  pending: "Pending",
  parsed: "Parsed",
  converted: "Converted",
  ignored: "Ignored",
};

export interface ParsedFields {
  customerName?: string;
  phone?: string;
  itemName?: string;
  category?: string;
  purityLabel?: string;
  permille?: number;
  estWeightG?: number;
  wastagePct?: number; // 0..100
  quantities?: { kind: string; count: number }[]; // e.g. [{ring: 7}, {bangle: 10}]
  deliveryDate?: string; // YYYY-MM-DD
  remarks?: string;
}

export interface WhatsappMessage {
  id: string;
  createdAt: number;
  updatedAt: number;
  senderName: string;
  senderPhone: string;
  rawText: string;
  status: WhatsappStatus;
  parsed?: ParsedFields;
  convertedOrderId?: string;
  linkedPersonId?: string;
  notes?: string;
}

interface WaState {
  messages: WhatsappMessage[];
  add: (
    m: Omit<WhatsappMessage, "id" | "createdAt" | "updatedAt" | "status"> & {
      status?: WhatsappStatus;
    },
  ) => WhatsappMessage;
  update: (id: string, patch: Partial<WhatsappMessage>) => void;
  remove: (id: string) => void;
  reset: () => void;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const whatsappInboxRepository = createRepository<WhatsappMessage>("whatsapp_inbox");

export const useWhatsapp = create<WaState>()((set, get) => ({
  messages: [],
  add: (input) => {
    const now = Date.now();
    const m: WhatsappMessage = {
      id: makeId(),
      createdAt: now,
      updatedAt: now,
      status: input.status ?? "pending",
      ...input,
    };
    set({ messages: [m, ...get().messages] });
    void whatsappInboxRepository.save(m);
    return m;
  },
  update: (id, patch) => {
    const updated = get().messages.map((m) =>
      m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m,
    );
    set({ messages: updated });
    const m = updated.find((x) => x.id === id);
    if (m) void whatsappInboxRepository.save(m);
  },
  remove: (id) => {
    set({ messages: get().messages.filter((m) => m.id !== id) });
    void whatsappInboxRepository.delete(id);
  },
  reset: () => set({ messages: [] }),
}));

const PURITY_MAP: Record<string, number> = {
  "24": 999,
  "22": 916,
  "20": 833,
  "18": 750,
  "14": 585,
};

function parseDeliveryDate(raw: string): string | undefined {
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yy}-${mm}-${dd}`;
  }
  // Try "25 June" / "25 June 2026"
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const m = raw
    .toLowerCase()
    .match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})?/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = String(months.indexOf(m[2]) + 1).padStart(2, "0");
    const yy = m[3] ?? String(new Date().getFullYear());
    return `${yy}-${mm}-${dd}`;
  }
  return undefined;
}

/** Heuristic parser for two common formats. */
export function parseWhatsappText(raw: string): ParsedFields {
  const out: ParsedFields = {};
  const text = raw.replace(/\s+/g, " ").trim();

  // Structured "Key: value, Key: value"
  const pairs: Record<string, string> = {};
  text.split(/[,\n]/).forEach((seg) => {
    const m = seg.match(/^\s*([A-Za-z ]+?)\s*[:=]\s*(.+?)\s*$/);
    if (m) pairs[m[1].toLowerCase().trim()] = m[2].trim();
  });
  if (pairs["customer"]) out.customerName = pairs["customer"];
  if (pairs["name"]) out.customerName = out.customerName ?? pairs["name"];
  if (pairs["mobile"] || pairs["phone"])
    out.phone = (pairs["mobile"] || pairs["phone"]).replace(/\D/g, "").slice(-10);
  if (pairs["item"]) out.itemName = pairs["item"];
  if (pairs["category"]) out.category = pairs["category"];
  if (pairs["purity"]) {
    out.purityLabel = pairs["purity"];
    const km = pairs["purity"].match(/(\d{2})\s*K/i);
    const pm = pairs["purity"].match(/(\d{3})/);
    if (pm) out.permille = parseInt(pm[1], 10);
    else if (km) out.permille = PURITY_MAP[km[1]];
  }
  const wkey = Object.keys(pairs).find((k) => k.includes("weight"));
  if (wkey) {
    const w = pairs[wkey].match(/([\d.]+)/);
    if (w) out.estWeightG = parseFloat(w[1]);
  }
  if (pairs["delivery"] || pairs["due"]) {
    out.deliveryDate = parseDeliveryDate(pairs["delivery"] || pairs["due"]);
  }
  if (pairs["remarks"] || pairs["notes"]) out.remarks = pairs["remarks"] || pairs["notes"];

  // Wastage charged
  const wastageKey = Object.keys(pairs).find((k) => k.includes("wastage"));
  if (wastageKey) {
    const m = pairs[wastageKey].match(/([\d.]+)\s*%/);
    if (m) out.wastagePct = parseFloat(m[1]);
  } else {
    const m = text.match(/wastage\s*(?:charged)?\s*[:=]?\s*([\d.]+)\s*%/i);
    if (m) out.wastagePct = parseFloat(m[1]);
  }

  // Item quantity hints — "7 rings, 10 bangles, 20 earrings"
  const qmap: Record<string, number> = {};
  const QTY_RE =
    /(\d+)\s+(rings?|bangles?|earrings?|pendants?|chains?|necklaces?|bracelets?|nose\s*pins?|mangalsutras?)/gi;
  let qm: RegExpExecArray | null;
  while ((qm = QTY_RE.exec(text)) !== null) {
    const kind = qm[2].toLowerCase().replace(/s$/, "").replace(/\s+/g, " ");
    qmap[kind] = (qmap[kind] || 0) + parseInt(qm[1], 10);
  }
  if (Object.keys(qmap).length > 0) {
    out.quantities = Object.entries(qmap).map(([kind, count]) => ({ kind, count }));
  }

  // Loose fallback
  if (!out.phone) {
    const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
    if (phoneMatch) out.phone = phoneMatch[1];
  }
  if (!out.permille) {
    const km = text.match(/(\d{2})\s*K\b/i);
    if (km) {
      out.permille = PURITY_MAP[km[1]];
      if (!out.purityLabel) out.purityLabel = `${km[1]}K`;
    }
  }
  if (!out.estWeightG) {
    const w = text.match(/([\d.]+)\s*g\b/i);
    if (w) out.estWeightG = parseFloat(w[1]);
  }
  if (!out.deliveryDate) {
    out.deliveryDate = parseDeliveryDate(text);
  }
  if (!out.customerName) {
    const before = out.phone ? text.split(out.phone)[0] : "";
    const name = before.match(/^([A-Za-z][A-Za-z .'-]{2,40}?)\s*$/);
    if (name) out.customerName = name[1].trim();
    else {
      const w = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
      if (w) out.customerName = w[1];
    }
  }
  if (!out.itemName) {
    const itm = text.match(
      /\b(filigree\s+\w+|ring|chain|earring|pendant|bangle|necklace|bracelet|mangalsutra|nose pin)\b/i,
    );
    if (itm) {
      out.itemName = itm[0];
      const cat = itm[0].split(/\s+/).pop()!.toLowerCase();
      out.category = cat.replace(/^./, (c) => c.toUpperCase());
    }
  }
  return out;
}

/** Pretty multi-line summary for clipboard copy. */
export function parsedSummary(p: ParsedFields): string {
  const lines: string[] = [];
  if (p.customerName) lines.push(`Customer: ${p.customerName}`);
  if (p.phone) lines.push(`Mobile: ${p.phone}`);
  if (p.itemName) lines.push(`Item: ${p.itemName}`);
  if (p.quantities && p.quantities.length) {
    lines.push(
      `Quantities: ${p.quantities.map((q) => `${q.count} ${q.kind}${q.count > 1 ? "s" : ""}`).join(", ")}`,
    );
  }
  if (p.purityLabel || p.permille) lines.push(`Purity: ${p.purityLabel ?? p.permille}`);
  if (p.estWeightG) lines.push(`Est Weight: ${p.estWeightG} g`);
  if (p.wastagePct != null) lines.push(`Wastage Charged: ${p.wastagePct}%`);
  if (p.deliveryDate) lines.push(`Delivery: ${p.deliveryDate}`);
  if (p.remarks) lines.push(`Remarks: ${p.remarks}`);
  return lines.join("\n");
}
