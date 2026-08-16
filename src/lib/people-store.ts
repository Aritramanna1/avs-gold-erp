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
import { archiveCentralPartyForPerson, syncPersonToCentralParty } from "@/lib/central-foundation";

export type PersonType =
  | "customer"
  | "firm_customer"
  | "jeweller"
  | "dealer"
  | "supplier"
  | "karigar"
  | "worker"
  | "outside_karigar"
  | "refinery"
  | "hallmark_vendor"
  | "agent"
  | "employee"
  | "service_provider"
  | "other"
  // Legacy compatibility aliases (kept for backward compat)
  | "vendor"
  | "outside_worker";

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  customer: "Customer",
  firm_customer: "Firm / Company Customer",
  jeweller: "Jeweller (B2B)",
  dealer: "Dealer",
  supplier: "Supplier",
  karigar: "Karigar",
  worker: "Worker",
  outside_karigar: "Outside Karigar",
  refinery: "Refinery",
  hallmark_vendor: "Hallmark Vendor (BIS)",
  agent: "Agent / Representative",
  employee: "Employee",
  service_provider: "Service Provider",
  other: "Other",
  // Legacy aliases
  vendor: "Vendor",
  outside_worker: "Outside Worker",
};

/** Category grouping for UI tabs */
export type PersonCategory = "customers" | "trade" | "karigars" | "employees" | "vendors";

export const PERSON_TYPE_CATEGORY: Record<PersonType, PersonCategory> = {
  customer: "customers",
  firm_customer: "customers",
  jeweller: "trade",
  dealer: "trade",
  supplier: "vendors",
  refinery: "vendors",
  hallmark_vendor: "vendors",
  service_provider: "vendors",
  karigar: "karigars",
  worker: "karigars",
  outside_karigar: "karigars",
  agent: "trade",
  employee: "employees",
  other: "vendors",
  // Legacy aliases
  vendor: "vendors",
  outside_worker: "karigars",
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

/** A single bank account entry — persons may hold multiple */
export interface BankAccount {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  accountType: "current" | "savings" | "cc" | "od";
  ifscCode: string;
  branchName?: string;
  upiId?: string;
  isPrimary: boolean;
  active: boolean;
}

export interface Person {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Primary role type — use `roles[]` for multi-role parties */
  type: PersonType;
  /** Multiple concurrent roles (e.g. a Karigar who is also a Customer) */
  roles?: PersonType[];
  active: boolean;

  // ── Identity ──────────────────────────────────────────────────────
  fullName: string;
  /** Trade / DBA name (displayed on invoices / documents) */
  tradeName?: string;
  /** Legal registered company name */
  legalName?: string;
  /** Primary contact person name for B2B parties */
  contactPerson?: string;
  phone: string;
  altPhone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;

  // ── Address ───────────────────────────────────────────────────────
  addressLine1?: string;
  addressLine2?: string;
  area?: string;
  villageCity?: string;
  district?: string;
  state?: string;
  pin?: string;
  /** Legacy alias for currentAddress */
  currentAddress?: string;
  permanentAddress?: string;

  // ── Tax & Compliance ──────────────────────────────────────────────
  aadhaar?: string; // last 4 stored / masked on display
  pan?: string;
  gstin?: string;
  /** MSME / Udyam Registration Number */
  msmeUdyamNo?: string;
  /** TAN (required for TDS deductors) */
  tan?: string;
  /** Business constitution: Proprietor / Partnership / Pvt Ltd / LLP etc */
  businessType?: string;
  /** GST Place of Supply (2-digit state code) */
  placeOfSupply?: string;
  /** TDS/TCS applicability flag: none / tds_applicable / tcs_applicable */
  tdsTcsApplicability?: "none" | "tds_applicable" | "tcs_applicable";

  // ── Credit & Limits ───────────────────────────────────────────────
  /** Cash credit limit in paise (₹0 = no limit) */
  cashCreditLimitPaise?: number;
  /** Fine Gold Metal Credit Limit in mg (0 = no limit) */
  goldCreditLimitMg?: number;
  /** Legacy alias */
  maxFineGoldCreditMg?: number;
  /** Payment due days (e.g. 30, 45, 60) */
  dueDays?: number;

  // ── Real Opening Balances (Single Source of Truth) ────────────────
  /** Cash opening balance in paise (positive = receivable / Dr, negative = payable / Cr) */
  cashOpeningBalancePaise?: number;
  /** Cash opening balance type: "receivable" (Dr) | "payable" (Cr) */
  cashOpeningType?: "receivable" | "payable";
  /** Gold opening gross weight in mg */
  goldOpeningGrossMg?: number;
  /** Gold opening touch/purity percentage (e.g. 91.6, 99.9) */
  goldOpeningTouch?: number;
  /** Gold opening fine gold in mg */
  goldOpeningFineMg?: number;
  /** Gold opening balance type: "receivable" (Dr) | "payable" (Cr) */
  goldOpeningType?: "receivable" | "payable";
  /** Silver opening fine weight in mg */
  silverOpeningFineMg?: number;
  /** Outstanding opening invoices count */
  openingBillsCount?: number;
  /** Opening balance date / voucher reference note */
  openingBalanceNotes?: string;

  // ── Multiple Bank Accounts ────────────────────────────────────────
  /** Multi-bank registry — replaces legacy single bank fields */
  bankAccounts?: BankAccount[];
  /** @deprecated Use bankAccounts[0] instead */
  bankAccountName?: string;
  /** @deprecated Use bankAccounts[0] instead */
  bankAccountNumber?: string;
  /** @deprecated Use bankAccounts[0] instead */
  bankIfsc?: string;
  /** @deprecated Use bankAccounts[0] instead */
  bankName?: string;

  // ── Worker / Karigar Specific ─────────────────────────────────────
  workType?: string;
  joiningDate?: string; // YYYY-MM-DD
  dailyWagePaise?: number;
  skills?: string;
  experience?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  anniversary?: string; // YYYY-MM-DD
  spouseName?: string;

  // ── References & Emergency ────────────────────────────────────────
  emergencyName?: string;
  emergencyPhone?: string;
  referenceName?: string;
  referencePhone?: string;
  referralPartyId?: string;

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
    // This store is now a small compatibility/detail cache. High-volume People
    // lists use `people-query.ts` for Supabase range/count pagination, so this
    // refresh must stay bounded.
    let q = supabase
      .from("people")
      .select("id,full_name,phone,email,type,active,created_at,updated_at,data")
      .order("updated_at", { ascending: false })
      .limit(250);
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
      await syncPersonToCentralParty(person);
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
    await syncPersonToCentralParty(updated);
    set((s) => ({ people: s.people.map((p) => (p.id === id ? updated : p)) }));
  },
  setActive: async (id, active) => {
    const current = get().people.find((p) => p.id === id);
    if (!current) return;
    const updated = { ...current, active, updatedAt: Date.now() };
    await peopleRepository.save(updated);
    await syncPersonToCentralParty(updated);
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
    await syncPersonToCentralParty(updated);
    set((s) => ({ people: s.people.map((p) => (p.id === id ? updated : p)) }));
  },
  remove: async (id) => {
    await peopleRepository.delete(id);
    await archiveCentralPartyForPerson(id);
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
  return PERSON_TYPE_CATEGORY[type] ?? "vendors";
}

/** Returns the primary bank account or constructs one from legacy single-bank fields */
export function getPrimaryBankAccount(p: Person): BankAccount | null {
  if (p.bankAccounts && p.bankAccounts.length > 0) {
    return p.bankAccounts.find((b) => b.isPrimary && b.active) ?? p.bankAccounts[0];
  }
  // Legacy single-bank fallback
  if (p.bankAccountNumber) {
    return {
      id: `legacy_${p.id}`,
      bankName: p.bankName ?? "",
      accountHolderName: p.bankAccountName ?? p.fullName,
      accountNumber: p.bankAccountNumber,
      accountType: "savings",
      ifscCode: p.bankIfsc ?? "",
      isPrimary: true,
      active: true,
    };
  }
  return null;
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
  newRequestedIssueMg: number,
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
    message,
  };
}
