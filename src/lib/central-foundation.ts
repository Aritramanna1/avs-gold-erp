import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Person } from "@/lib/people-store";

const centralDb = supabase as any;

function partyRolesForPerson(person: Person): string[] {
  switch (person.type) {
    case "customer":
    case "firm_customer":
      return ["customer"];
    case "karigar":
    case "worker":
    case "outside_worker":
      return ["karigar"];
    case "employee":
      return ["employee"];
    case "vendor":
      return ["supplier"];
    default:
      return ["other_counterparty"];
  }
}

let cachedCentralFirmId: string | null = null;

export async function syncPersonToCentralParty(person: Person): Promise<void> {
  const partyId = crypto.randomUUID();

  // Resolve and cache firm_id
  let firmId = cachedCentralFirmId;
  if (!firmId) {
    const { data: userResult } = await centralDb.auth.getUser();
    const userId = userResult?.user?.id;
    if (userId) {
      const { data: profile } = await centralDb
        .from("user_profiles")
        .select("firm_id")
        .eq("auth_id", userId)
        .maybeSingle();
      if (profile?.firm_id) {
        firmId = profile.firm_id;
        cachedCentralFirmId = firmId;
      }
    }
  }

  // Lookup existing central party by (firm_id, party_code) to prevent duplicate key violations
  let q = centralDb.from("central_parties").select("id");
  if (firmId) {
    q = q.eq("firm_id", firmId).eq("party_code", person.id);
  } else {
    q = q.eq("metadata->>source_table", "people").eq("metadata->>source_id", person.id);
  }
  const { data: existing, error: existingError } = await q.maybeSingle();

  if (existingError) throw new Error(`central party lookup failed: ${existingError.message}`);

  const centralPartyId = (existing as { id?: string } | null)?.id ?? partyId;
  const partyRow: any = {
    id: centralPartyId,
    party_code: person.id,
    display_name: person.fullName,
    legal_name: person.fullName,
    party_kind:
      person.type === "firm_customer" || person.type === "vendor" ? "organization" : "person",
    status: person.active ? "active" : "inactive",
    gstin: person.gstin ?? null,
    pan: person.pan ?? null,
    primary_phone: person.phone ?? null,
    primary_email: person.email ?? null,
    default_branch_id: person.branchId ?? null,
    opening_cash_balance_paise: 0,
    opening_fine_gold_mg: 0,
    metadata: {
      source_table: "people",
      source_id: person.id,
      person_type: person.type,
      village_city: person.villageCity ?? null,
      state: person.state ?? null,
      aadhaar_masked: person.aadhaar ? `XXXX${person.aadhaar.replace(/\D/g, "").slice(-4)}` : null,
      work_type: person.workType ?? null,
      notes: person.notes ?? null,
    },
  };

  if (firmId) {
    partyRow.firm_id = firmId;
  }

  const { error: partyError } = await centralDb
    .from("central_parties")
    .upsert(partyRow, { onConflict: "id" });
  if (partyError) throw new Error(`central party save failed: ${partyError.message}`);

  const roleRows = partyRolesForPerson(person).map((role) => ({
    party_id: centralPartyId,
    role,
    status: person.active ? "active" : "inactive",
    role_data: {
      source_table: "people",
      source_id: person.id,
      person_type: person.type,
      max_fine_gold_credit_mg: person.maxFineGoldCreditMg ?? null,
      skills: person.skills ?? null,
      work_type: person.workType ?? null,
    },
  }));

  const { error: roleError } = await centralDb
    .from("central_party_roles")
    .upsert(roleRows, { onConflict: "party_id,role" });
  if (roleError) throw new Error(`central party role save failed: ${roleError.message}`);

  const contacts = [
    person.phone
      ? {
          party_id: centralPartyId,
          contact_type: "phone",
          label: "Primary phone",
          value: person.phone,
          is_primary: true,
          metadata: { source_table: "people", source_id: person.id },
        }
      : null,
    person.email
      ? {
          party_id: centralPartyId,
          contact_type: "email",
          label: "Primary email",
          value: person.email,
          is_primary: true,
          metadata: { source_table: "people", source_id: person.id },
        }
      : null,
    person.currentAddress
      ? {
          party_id: centralPartyId,
          contact_type: "address",
          label: "Current address",
          value: person.currentAddress,
          is_primary: true,
          metadata: { source_table: "people", source_id: person.id },
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  if (contacts.length > 0) {
    await centralDb.from("central_party_contacts").delete().eq("party_id", centralPartyId);
    const { error: contactError } = await centralDb.from("central_party_contacts").insert(contacts);
    if (contactError)
      throw new Error(`central party contacts save failed: ${contactError.message}`);
  }

  const { error: activityError } = await centralDb.rpc("central_track_activity", {
    p_entity_type: "party",
    p_entity_id: centralPartyId,
    p_event_type: existing ? "party.synced" : "party.created",
    p_title: existing ? "Party profile synced" : "Party profile created",
    p_description: `${person.fullName} synced from People registry.`,
    p_branch_id: person.branchId ?? null,
    p_related_party_id: centralPartyId,
    p_related_transaction_id: null,
    p_related_document_id: null,
    p_severity: "info",
    p_metadata: { source_table: "people", source_id: person.id, person_type: person.type },
  });
  if (activityError) throw new Error(`central activity save failed: ${activityError.message}`);
}

export async function archiveCentralPartyForPerson(personId: string): Promise<void> {
  const { data, error } = await centralDb
    .from("central_parties")
    .select("id")
    .eq("metadata->>source_table", "people")
    .eq("metadata->>source_id", personId)
    .maybeSingle();
  if (error) throw new Error(`central party archive lookup failed: ${error.message}`);
  const id = (data as { id?: string } | null)?.id;
  if (!id) return;
  const { error: updateError } = await centralDb
    .from("central_parties")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) throw new Error(`central party archive failed: ${updateError.message}`);
}

export async function findPersonIdForCentralParty(centralPartyId: string): Promise<string | null> {
  const { data, error } = await centralDb
    .from("central_parties")
    .select("metadata")
    .eq("id", centralPartyId)
    .maybeSingle();
  if (error) throw new Error(`central party lookup failed: ${error.message}`);
  const metadata = (data as { metadata?: Record<string, unknown> } | null)?.metadata ?? {};
  if (metadata.source_table !== "people" || typeof metadata.source_id !== "string") return null;
  return metadata.source_id;
}
