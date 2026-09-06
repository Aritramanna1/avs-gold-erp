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
    const { data: sessionResult } = await centralDb.auth.getSession();
    const userId = sessionResult?.session?.user?.id;
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

  if (firmId && person.bankAccounts && person.bankAccounts.length > 0) {
    try {
      await centralDb.from("party_bank_accounts").delete().eq("party_id", person.id);
      const baRows = person.bankAccounts.map((ba) => ({
        firm_id: firmId,
        party_id: person.id,
        bank_name: ba.bankName || "",
        account_holder_name: ba.accountHolderName || person.fullName,
        account_number: ba.accountNumber || "",
        account_type: ba.accountType || "current",
        ifsc_code: ba.ifscCode || "",
        branch_name: ba.branchName || null,
        upi_id: ba.upiId || null,
        is_primary: ba.isPrimary ?? false,
        is_verified: (ba as any).isVerified ?? false,
        metadata: { source: "people" },
      }));
      await (centralDb as any).from("party_bank_accounts").insert(baRows);
    } catch (e) {
      console.warn("Could not sync party_bank_accounts:", e);
    }
  }

  if (firmId) {
    try {
      await centralDb.from("party_role_profiles").upsert(
        {
          firm_id: firmId,
          party_id: person.id,
          role_type: person.type,
          credit_limit_paise: person.cashCreditLimitPaise || 0,
          metal_limit_mg: person.goldCreditLimitMg || person.maxFineGoldCreditMg || 0,
          credit_days: person.dueDays || 0,
          is_active: person.active ?? true,
          settings: {
            roles: person.roles,
            tradeName: person.tradeName,
            legalName: person.legalName,
            gstin: person.gstin,
            pan: person.pan,
            tan: person.tan,
            msmeUdyamNo: person.msmeUdyamNo,
            placeOfSupply: person.placeOfSupply,
            tdsTcsApplicability: person.tdsTcsApplicability,
          },
        },
        { onConflict: "id" },
      );
    } catch (e) {
      console.warn("Could not sync party_role_profiles:", e);
    }
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

export interface PartyActivityEvent {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  severity: string;
  occurredAt: string;
}

export interface PartyMessage {
  id: string;
  threadId: string;
  threadSubject: string | null;
  channel: string;
  direction: string;
  body: string | null;
  createdAt: string;
}

export interface PartyTimelineData {
  centralPartyId: string | null;
  events: PartyActivityEvent[];
  messages: PartyMessage[];
}

// Resolve the central_parties.id synced for a People-registry person.
async function resolveCentralPartyId(personId: string): Promise<string | null> {
  const { data, error } = await centralDb
    .from("central_parties")
    .select("id")
    .eq("party_code", personId)
    .maybeSingle();
  if (error) throw new Error(`central party lookup failed: ${error.message}`);
  return (data as { id?: string } | null)?.id ?? null;
}

// Party 360 Timeline tab: activity events + message threads for a person.
// ponytail: two sequential queries after id lookup, no client-side join framework needed for this volume.
export async function getPartyTimelineData(personId: string): Promise<PartyTimelineData> {
  const centralPartyId = await resolveCentralPartyId(personId);
  if (!centralPartyId) return { centralPartyId: null, events: [], messages: [] };

  const [eventsRes, threadsRes] = await Promise.all([
    centralDb
      .from("central_activity_events")
      .select("id,event_type,title,description,severity,occurred_at")
      .or(`entity_id.eq.${centralPartyId},related_party_id.eq.${centralPartyId}`)
      .order("occurred_at", { ascending: false })
      .limit(50),
    centralDb
      .from("central_message_threads")
      .select("id,subject,channel")
      .eq("party_id", centralPartyId),
  ]);
  if (eventsRes.error) throw new Error(`activity timeline load failed: ${eventsRes.error.message}`);
  if (threadsRes.error) throw new Error(`message thread load failed: ${threadsRes.error.message}`);

  const threads = (threadsRes.data ?? []) as {
    id: string;
    subject: string | null;
    channel: string;
  }[];
  const threadById = new Map(threads.map((t) => [t.id, t]));
  let messages: PartyMessage[] = [];
  if (threads.length > 0) {
    const { data: msgData, error: msgError } = await centralDb
      .from("central_messages")
      .select("id,thread_id,direction,body,created_at")
      .in(
        "thread_id",
        threads.map((t) => t.id),
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (msgError) throw new Error(`message load failed: ${msgError.message}`);
    messages = (msgData ?? []).map((m: any) => ({
      id: m.id,
      threadId: m.thread_id,
      threadSubject: threadById.get(m.thread_id)?.subject ?? null,
      channel: threadById.get(m.thread_id)?.channel ?? "in_app",
      direction: m.direction,
      body: m.body,
      createdAt: m.created_at,
    }));
  }

  const events: PartyActivityEvent[] = ((eventsRes.data ?? []) as any[]).map((e) => ({
    id: e.id,
    eventType: e.event_type,
    title: e.title,
    description: e.description,
    severity: e.severity,
    occurredAt: e.occurred_at,
  }));

  return { centralPartyId, events, messages };
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
