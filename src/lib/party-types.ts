import type { Person, PersonType } from "@/lib/people-store";

export const CUSTOMER_PARTY_TYPES: PersonType[] = ["customer", "firm_customer"];
export const SUPPLIER_PARTY_TYPES: PersonType[] = [
  "supplier",
  "vendor",
  "refinery",
  "hallmark_vendor",
  "service_provider",
];
export const KARIGAR_PARTY_TYPES: PersonType[] = [
  "karigar",
  "worker",
  "outside_worker",
  "outside_karigar",
];

export function isCustomerParty(p: Pick<Person, "type">): boolean {
  return CUSTOMER_PARTY_TYPES.includes(p.type);
}

export function isSupplierParty(p: Pick<Person, "type">): boolean {
  return SUPPLIER_PARTY_TYPES.includes(p.type);
}

export function isKarigarParty(p: Pick<Person, "type">): boolean {
  return KARIGAR_PARTY_TYPES.includes(p.type);
}
