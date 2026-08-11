/**
 * MTJ ERP — People / KYC store
 * Persistent registry of every human/entity the shop interacts with.
 */
import { create } from "zustand";
import { useAttachments } from "./attachments-store";
import { getNextSequenceSync } from "./sequence-manager";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
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

  maxFineGoldCreditMg?: number; // Fine Gold Metal Credit Limit in mg (Section 42/Audit)

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
  anniversary?: string; // YYYY-MM-DD

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
    let resolvedRole = currentUserRole;
    if (!resolvedRole) {
      const [{ data: sessionResult }, { data: profileResult }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]).then(async ([session, user]) => {
        if (!session.data.session?.user.id) return [session, { data: null }] as const;
        const profile = await supabase
          .from("user_profiles")
          .select("role")
          .eq("auth_id", session.data.session.user.id)
          .maybeSingle();
        return [session, profile] as const;
      });
      resolvedRole = profileResult?.role ?? null;
      void sessionResult;
    }
    // The persisted Supabase role values are lower-case (`owner`, `admin`,
    // `saas_admin`) while older local profiles used display labels. Owners
    // and firm admins are intentionally firm-global; branch staff remain
    // branch-filtered.
    const GLOBAL_ROLES = [
      "Super Owner",
      "Administrator",
      "CEO (View Only)",
      "owner",
      "admin",
      "saas_admin",
    ];
    const bid =
      !resolvedRole || GLOBAL_ROLES.includes(resolvedRole) ? null : selectedBranchId || "MAIN";
    // The target schema retains indexed person columns alongside the legacy
    // JSON document. Read both shapes: older imports and QA/onboarding rows
    // may have identity fields in columns while newer writes keep the full
    // domain object in `data`.
    let q = supabase
      .from("people")
      .select("id,full_name,phone,email,type,active,created_at,updated_at,data")
      .limit(5000);
    if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
    const { data, error } = await q;
    if (error) {
      console.error("Error fetching people from database:", error);
      return;
    }
    const rows = (data ?? [])
      .map((r) => {
        const document = (r.data ?? {}) as Partial<Person>;
        return {
          ...document,
          id: document.id ?? r.id,
          fullName: document.fullName ?? r.full_name,
          phone: document.phone ?? r.phone ?? "",
          email: document.email ?? r.email ?? undefined,
          type: document.type ?? (r.type as PersonType),
          active: document.active ?? r.active ?? true,
          createdAt: document.createdAt ?? (Date.parse(r.created_at ?? "") || Date.now()),
          updatedAt: document.updatedAt ?? (Date.parse(r.updated_at ?? "") || Date.now()),
          docs: document.docs ?? {},
        } as Person;
      })
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
        // AFTER the spread, so an explicit `branchId: undefined` or "" on the
        // input can't clobber the default back to nothing.
        //
        // Defaulted HERE rather than in each form, because refresh() filters
        // people by branch for non-global roles: a person saved without a
        // branchId is invisible to the very user who just created them. The
        // People form set this itself; Quick Add (Orders) did not — so a
        // quick-added customer vanished from People on the next refresh while
        // the order kept pointing at them.
        branchId: input.branchId || useSettings.getState().selectedBranchId || undefined,
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
    const isAttFileUploaded = !!(
      att?.checksum ||
      att?.fileDataUrl ||
      att?.storagePath ||
      att?.fileName
    );
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

export interface MetalCreditCheckResult {
  isExceeded: boolean;
  currentBalanceFineGoldMg: number;
  newRequestedIssueMg: number;
  projectedBalanceFineGoldMg: number;
  creditLimitMg: number;
  message: string;
}

/**
 * Validates if issuing new fine gold will exceed the Karigar or Party's assigned metal credit limit.
 */
export function validateMetalCreditLimit(
  person: Person,
  currentBalanceFineGoldMg: number,
  newRequestedIssueMg: number
): MetalCreditCheckResult {
  const creditLimitMg = person.maxFineGoldCreditMg || 0;
  const projectedBalanceFineGoldMg = currentBalanceFineGoldMg + newRequestedIssueMg;
  const isExceeded = creditLimitMg > 0 && projectedBalanceFineGoldMg > creditLimitMg;

  const currentGrams = (currentBalanceFineGoldMg / 1000).toFixed(3);
  const requestedGrams = (newRequestedIssueMg / 1000).toFixed(3);
  const projectedGrams = (projectedBalanceFineGoldMg / 1000).toFixed(3);
  const limitGrams = (creditLimitMg / 1000).toFixed(3);

  const message = isExceeded
    ? `⚠️ METAL CREDIT LIMIT EXCEEDED: ${person.fullName} has limit ${limitGrams}g. Current: ${currentGrams}g + Issue: ${requestedGrams}g = Projected: ${projectedGrams}g.`
    : `OK: Projected balance ${projectedGrams}g is within limit ${limitGrams}g.`;

  return {
    isExceeded,
    currentBalanceFineGoldMg,
    newRequestedIssueMg,
    projectedBalanceFineGoldMg,
    creditLimitMg,
    message
  };
}

