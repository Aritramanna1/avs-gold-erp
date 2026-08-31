import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Person, PersonType } from "@/lib/people-store";
import { resolveFirmIdForQuery, withFirmScope } from "@/lib/firm-scoped-query";

export interface PeoplePageQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  types?: PersonType[];
  branchId?: string | null;
}

export interface PeoplePageResult {
  people: Person[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export type PeopleTabCounts = Record<
  "customers" | "firms" | "karigars" | "employees" | "vendors",
  number
>;

type PeopleRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  type: PersonType | null;
  active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  data: Partial<Person> | null;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function clampPage(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) return 1;
  return Math.floor(value);
}

function clampPageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || !value) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(10, Math.floor(value)));
}

function remoteLike(query: string): string {
  const cleaned = query.trim().replace(/[,%]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  return `%${cleaned}%`;
}

export function rowToPerson(row: PeopleRow): Person | null {
  const data = row.data ?? {};
  const id = data.id ?? row.id;
  const fullName = data.fullName ?? row.full_name ?? "";
  const type = data.type ?? row.type;
  if (!id || !fullName || !type) return null;

  return {
    id,
    createdAt: data.createdAt ?? (Date.parse(row.created_at ?? "") || Date.now()),
    updatedAt: data.updatedAt ?? (Date.parse(row.updated_at ?? "") || Date.now()),
    type,
    roles: data.roles,
    active: data.active ?? row.active ?? true,
    fullName,
    tradeName: data.tradeName,
    legalName: data.legalName,
    contactPerson: data.contactPerson,
    phone: data.phone ?? row.phone ?? "",
    altPhone: data.altPhone,
    whatsapp: data.whatsapp,
    email: data.email ?? row.email ?? undefined,
    website: data.website,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    area: data.area,
    villageCity: data.villageCity,
    district: data.district,
    state: data.state,
    pin: data.pin,
    currentAddress: data.currentAddress,
    permanentAddress: data.permanentAddress,
    aadhaar: data.aadhaar,
    pan: data.pan,
    gstin: data.gstin,
    msmeUdyamNo: data.msmeUdyamNo,
    tan: data.tan,
    businessType: data.businessType,
    placeOfSupply: data.placeOfSupply,
    tdsTcsApplicability: data.tdsTcsApplicability,
    cashCreditLimitPaise: data.cashCreditLimitPaise,
    goldCreditLimitMg: data.goldCreditLimitMg ?? data.maxFineGoldCreditMg,
    maxFineGoldCreditMg: data.maxFineGoldCreditMg ?? data.goldCreditLimitMg,
    dueDays: data.dueDays,
    bankAccounts: data.bankAccounts,
    bankAccountName: data.bankAccountName,
    bankAccountNumber: data.bankAccountNumber,
    bankIfsc: data.bankIfsc,
    bankName: data.bankName,
    workType: data.workType,
    joiningDate: data.joiningDate,
    compensationMode: data.compensationMode,
    dailyWagePaise: data.dailyWagePaise,
    skills: data.skills,
    experience: data.experience,
    dateOfBirth: data.dateOfBirth,
    anniversary: data.anniversary,
    spouseName: data.spouseName,
    emergencyName: data.emergencyName,
    emergencyPhone: data.emergencyPhone,
    referenceName: data.referenceName,
    referencePhone: data.referencePhone,
    referralPartyId: data.referralPartyId,
    notes: data.notes,
    branchId: data.branchId,
    kycProgress: data.kycProgress,
    docs: data.docs ?? {},
    customForms: data.customForms,
  };
}

function applyPeopleFilters(query: any, input: PeoplePageQuery) {
  let next = query;
  if (input.branchId) next = next.filter("data->>branchId", "eq", input.branchId);
  if (input.types?.length) next = next.in("type", input.types);
  const q = input.query?.trim();
  if (q) {
    const like = remoteLike(q);
    next = next.or(
      `full_name.ilike.${like},phone.ilike.${like},email.ilike.${like},type.ilike.${like}`,
    );
  }
  return next;
}

export async function fetchPeoplePage(input: PeoplePageQuery = {}): Promise<PeoplePageResult> {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) {
    return { people: [], page, pageSize, totalCount: 0 };
  }
  const db = supabase as any;

  const result = await applyPeopleFilters(
    withFirmScope(
      db
        .from("people")
        .select("id,full_name,phone,email,type,active,created_at,updated_at,data", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to),
      firmId,
    ),
    input,
  );

  if (result.error) throw new Error(result.error.message ?? "Could not load people.");
  const people = ((result.data ?? []) as PeopleRow[])
    .map(rowToPerson)
    .filter((person): person is Person => !!person);

  return {
    people,
    page,
    pageSize,
    totalCount: result.count ?? people.length,
  };
}

async function countPeople(types: PersonType[], branchId?: string | null): Promise<number> {
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) return 0;
  const db = supabase as any;
  const result = await applyPeopleFilters(
    withFirmScope(db.from("people").select("id", { count: "exact", head: true }), firmId),
    { types, branchId },
  );
  if (result.error) return 0;
  return result.count ?? 0;
}

export async function fetchPeopleTabCounts(branchId?: string | null): Promise<PeopleTabCounts> {
  const [customers, firms, karigars, employees, vendors] = await Promise.all([
    countPeople(["customer", "firm_customer"], branchId),
    countPeople(["jeweller", "dealer", "agent", "firm_customer"], branchId),
    countPeople(["karigar", "worker", "outside_karigar", "outside_worker"], branchId),
    countPeople(["employee"], branchId),
    countPeople(
      ["supplier", "refinery", "hallmark_vendor", "service_provider", "other", "vendor"],
      branchId,
    ),
  ]);

  return { customers, firms, karigars, employees, vendors };
}
