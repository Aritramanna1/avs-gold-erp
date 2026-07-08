/**
 * MTJ ERP — People / KYC store
 * Persistent registry of every human/entity the shop interacts with.
 */
import { create } from "zustand";
import { useAttachments } from "./attachments-store";
import { getNextSequenceSync } from "./sequence-manager";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "./settings-store";
import { createRepository } from "./repositories/base-repository";

export type PersonType =
  "customer" | "firm_customer" | "karigar" | "worker" | "employee" | "vendor" | "outside_worker";

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  customer: "Customer",
  firm_customer: "Firm / Company Customer",
  karigar: "Karigar",
  worker: "Worker",
  employee: "Employee",
  vendor: "Vendor",
  outside_worker: "Outside Worker",
};

export type KycDocKey =
  "photo" | "aadhaar_front" | "aadhaar_back" | "pan" | "address_proof" | "signature";

export const KYC_DOC_LABELS: Record<KycDocKey, string> = {
  photo: "Photo",
  aadhaar_front: "Aadhaar Front",
  aadhaar_back: "Aadhaar Back",
  pan: "PAN",
  address_proof: "Address Proof",
  signature: "Signature / Thumb",
};

export interface Person {
  id: string;
  createdAt: number;
  updatedAt: number;
  type: PersonType;
  active: boolean;

  fullName: string;
  phone: string;
  altPhone?: string;
  email?: string;

  currentAddress?: string;
  permanentAddress?: string;
  villageCity?: string;
  state?: string;

  aadhaar?: string; // last 4 stored / masked on display
  pan?: string;
  gstin?: string;

  workType?: string;
  joiningDate?: string; // YYYY-MM-DD

  emergencyName?: string;
  emergencyPhone?: string;
  referenceName?: string;
  referencePhone?: string;

  /** Worker / karigar financial details */
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  dailyWagePaise?: number; // wage per day in paise
  skills?: string; // comma-separated or free text
  experience?: string; // e.g. "5 years goldsmithing"
  dateOfBirth?: string; // YYYY-MM-DD

  notes?: string;
  branchId?: string;

  /** Computed KYC completion label — populated at runtime, not stored in DB. */
  kycProgress?: string;

  /** Whether the placeholder doc slots are marked "on file" (paper register). */
  docs: Partial<Record<KycDocKey, boolean>>;

  /** Dynamic forms data attached to this person. */
  customForms?: Record<string, Record<string, any>>;
}

interface PeopleState {
  people: Person[];
  refresh: () => Promise<void>;
  add: (
    p: Omit<Person, "id" | "createdAt" | "updatedAt" | "docs"> & { docs?: Person["docs"] },
  ) => Promise<Person>;
  update: (id: string, patch: Partial<Person>) => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
  toggleDoc: (id: string, key: KycDocKey) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const peopleRepository = createRepository<Person>("people");

// Serializes usePeople.add() calls (see below) so concurrent/double-submit
// invocations never generate the same sequential ID.
let addQueue: Promise<unknown> = Promise.resolve();

export const usePeople = create<PeopleState>()((set, get) => ({
  people: [],
  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";
    let q = supabase.from("people").select("data").limit(5000);
    if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
    const { data, error } = await q;
    if (error) {
      console.error("Error fetching people from database:", error);
      return;
    }
    const rows = (data ?? [])
      .map((r) => r.data as Person | null)
      .filter((p): p is Person => !!p && !!p.id && !!p.fullName);
    set({ people: rows });
  },
  add: (input) => {
    // Serialize concurrent add() calls so ID generation always reads the
    // latest local state and a double-submit cannot compute the same
    // sequential ID twice (which previously caused duplicate/overwritten rows).
    addQueue = addQueue.then(async () => {
      const now = Date.now();
      const isWorker = ["karigar", "worker", "employee"].includes(input.type);
      const seqType = isWorker ? "worker" : "customer";
      const generatedId = getNextSequenceSync(seqType);
      const person: Person = {
        id: generatedId,
        createdAt: now,
        updatedAt: now,
        docs: input.docs ?? {},
        ...input,
      };
      await peopleRepository.save(person);
      // Optimistic local update — realtime will confirm from DB
      set((s) => ({ people: [person, ...s.people] }));
      return person;
    });
    return addQueue as Promise<Person>;
  },
  update: async (id, patch) => {
    const current = get().people.find((p) => p.id === id);
    if (!current) return;
    const updated = { ...current, ...patch, updatedAt: Date.now() };
    await peopleRepository.save(updated);
    set((s) => ({ people: s.people.map((p) => (p.id === id ? updated : p)) }));
  },
  setActive: async (id, active) => {
    const current = get().people.find((p) => p.id === id);
    if (!current) return;
    const updated = { ...current, active, updatedAt: Date.now() };
    await peopleRepository.save(updated);
    set((s) => ({ people: s.people.map((p) => (p.id === id ? updated : p)) }));
  },
  toggleDoc: async (id, key) => {
    const current = get().people.find((p) => p.id === id);
    if (!current) return;
    const updated = {
      ...current,
      docs: { ...current.docs, [key]: !current.docs[key] },
      updatedAt: Date.now(),
    };
    await peopleRepository.save(updated);
    set((s) => ({ people: s.people.map((p) => (p.id === id ? updated : p)) }));
  },
  remove: async (id) => {
    await peopleRepository.delete(id);
    set((s) => ({ people: s.people.filter((p) => p.id !== id) }));
  },
  reset: () => set({ people: [] }),
}));

export function maskAadhaar(a?: string): string {
  if (!a) return "—";
  const digits = a.replace(/\D/g, "");
  if (digits.length < 4) return "—";
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function kycComplete(p: Person): boolean {
  const required: KycDocKey[] = ["photo", "aadhaar_front", "aadhaar_back"];
  return required.every((k) => {
    const isDocMarked = !!p.docs[k];
    const attKey = `person:${p.id}:${k}`;
    const att = useAttachments.getState().items[attKey];
    const isAttFileUploaded = !!(att?.fileDataUrl || att?.storagePath || att?.fileName);
    return isDocMarked || isAttFileUploaded;
  });
}

export function tabsForType(type: PersonType): string {
  // groups types into the 5 tabs
  if (type === "customer") return "customers";
  if (type === "firm_customer") return "firms";
  if (type === "karigar" || type === "worker") return "karigars";
  if (type === "employee") return "employees";
  return "vendors"; // vendor or outside_worker
}
