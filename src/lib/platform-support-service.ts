import { dataProvider } from "@/lib/providers/data-provider";

const supabase = dataProvider as any;
const SUPPORT_RPC_TIMEOUT_MS = 8000;

export type SupportTicket = {
  id: string;
  ticket_no: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
};

export type SupportThreadMessage = {
  id: string;
  body: string;
  status: string;
  created_at: string;
  sender: "customer" | "support";
};

export type SupportThread = {
  ticket: SupportTicket;
  messages: SupportThreadMessage[];
};

type CreateSupportTicketInput = {
  subject: string;
  description: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
};

type SupabaseResult<T = unknown> = {
  data: T | null;
  error: { message?: string } | Error | null;
};

type RestSession = {
  accessToken: string;
  url: string;
  key: string;
};

function cleanSubject(subject: string): string {
  return subject.trim().slice(0, 160);
}

function cleanBody(body: string): string {
  return body.trim().slice(0, 10000);
}

function supportTicketNo(prefix = "STF"): string {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = SUPPORT_RPC_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getEnvValue(key: string): string {
  return ((import.meta.env[key] as string | undefined) ?? "").trim().replace(/^['"]|['"]$/g, "");
}

async function getRestSession(): Promise<RestSession> {
  const url = getEnvValue("VITE_SUPABASE_URL");
  const key = getEnvValue("VITE_SUPABASE_PUBLISHABLE_KEY");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const accessToken = data.session?.access_token;
  if (!url || !key || !accessToken) {
    throw new Error("Please sign in again before using support.");
  }
  return { url: url.replace(/\/$/, ""), key, accessToken };
}

function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

async function createRemoteSupportTicket(input: {
  subject: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
}): Promise<SupportTicket> {
  return restRequest<SupportTicket>("rpc/create_staff_support_ticket", {
    method: "POST",
    body: JSON.stringify({
      p_subject: input.subject,
      p_description: input.description,
      p_category: input.category,
      p_priority: input.priority,
    }),
  });
}

async function restRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = SUPPORT_RPC_TIMEOUT_MS,
): Promise<T> {
  const session = await getRestSession();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${session.url}/rest/v1/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: session.key,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error_description || data?.hint || response.statusText,
      );
    }
    return data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function rpcWithFallback<T>(
  run: () => Promise<SupabaseResult<T>>,
  label: string,
): Promise<SupabaseResult<T>> {
  return withTimeout(Promise.resolve().then(run), label).catch((error) => ({ error, data: null }));
}

async function getActiveFirmProfile() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const userId = data.user?.id ?? null;
  if (!userId) throw new Error("Please sign in again before creating a support ticket.");

  let profileError: unknown = null;
  const profileRows = await restRequest<
    Array<{
      auth_id: string;
      firm_id: string | null;
      branch_id: string | null;
      active: boolean;
      status: string;
    }>
  >(
    `user_profiles?select=auth_id,firm_id,branch_id,active,status&auth_id=eq.${encodeURIComponent(
      userId,
    )}&active=eq.true&status=eq.active&firm_id=not.is.null&limit=1`,
  ).catch((error) => {
    profileError = error;
    return null;
  });
  const profile = profileRows?.[0];
  if (profile?.firm_id) {
    return {
      userId,
      firmId: profile.firm_id,
      branchId: profile.branch_id ?? null,
    };
  }
  if (profileError) throw toError(profileError, "Could not load the active support profile.");
  throw new Error("No active firm profile is linked to this account.");
}

async function ensureConversation(ticketId: string, firmId: string): Promise<string> {
  const existingRest = await restRequest<Array<{ id: string }>>(
    `platform_conversations?select=id&ticket_id=eq.${encodeURIComponent(ticketId)}&limit=1`,
  ).catch(() => null);
  if (existingRest?.[0]?.id) return existingRest[0].id;

  const createdRest = await restRequest<Array<{ id: string }>>("platform_conversations?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ticket_id: ticketId, firm_id: firmId, status: "open" }),
  }).catch(() => null);
  if (createdRest?.[0]?.id) return createdRest[0].id;

  const existing = await supabase
    .from("platform_conversations")
    .select("id")
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase
    .from("platform_conversations")
    .insert({ ticket_id: ticketId, firm_id: firmId, status: "open" })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.message);
  return created.data.id as string;
}

export async function createSupportTicket(input: CreateSupportTicketInput): Promise<SupportTicket> {
  const subject = cleanSubject(input.subject);
  const description = cleanBody(input.description);
  const category = (input.category ?? "staff").trim().slice(0, 80) || "staff";
  const priority = input.priority ?? "normal";

  if (subject.length < 3) throw new Error("Ticket subject must be at least 3 characters.");
  if (description.length < 10)
    throw new Error("Ticket description must be at least 10 characters.");

  const rpcResult = await rpcWithFallback<SupportTicket>(
    () =>
      supabase.rpc("create_staff_support_ticket", {
        p_subject: subject,
        p_description: description,
        p_category: category,
        p_priority: priority,
      }),
    "Support ticket creation",
  );
  if (!rpcResult.error && rpcResult.data?.id) {
    const ticket = rpcResult.data as SupportTicket;
    return ticket;
  }

  let profile: Awaited<ReturnType<typeof getActiveFirmProfile>>;
  try {
    profile = await getActiveFirmProfile();
  } catch (profileError) {
    throw new Error(
      rpcResult.error?.message || toError(profileError, "Could not load support profile.").message,
    );
  }

  let restCreateError: unknown = null;
  const restTicket = await restRequest<SupportTicket[]>(
    "platform_support_tickets?select=id,ticket_no,subject,status,priority,created_at",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ticket_no: supportTicketNo("FIRM"),
        firm_id: profile.firmId,
        branch_id: profile.branchId,
        requester_id: profile.userId,
        category,
        subject,
        description,
        priority,
        severity: priority === "urgent" ? "critical" : priority === "high" ? "high" : "normal",
        status: "open",
      }),
    },
  ).catch((error) => {
    restCreateError = error;
    return null;
  });
  if (restTicket?.[0]?.id) {
    const ticket = restTicket[0];
    const conversationId = await ensureConversation(ticket.id, profile.firmId);
    await restRequest("platform_conversation_messages", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        sender_id: profile.userId,
        body: description,
        visibility: "customer",
      }),
    }).catch(() => null);
    return ticket;
  }

  const inserted = await supabase
    .from("platform_support_tickets")
    .insert({
      ticket_no: supportTicketNo(),
      firm_id: profile.firmId,
      branch_id: profile.branchId,
      requester_id: profile.userId,
      category,
      subject,
      description,
      priority,
      severity: priority === "urgent" ? "critical" : priority === "high" ? "high" : "normal",
      status: "open",
    })
    .select("id,ticket_no,subject,status,priority,created_at")
    .single();
  if (inserted.error) {
    throw new Error(
      rpcResult.error?.message ||
        toError(restCreateError, "Could not create the support ticket.").message ||
        inserted.error.message,
    );
  }

  const ticket = inserted.data as SupportTicket;
  const conversationId = await ensureConversation(ticket.id, profile.firmId);
  const message = await supabase.from("platform_conversation_messages").insert({
    conversation_id: conversationId,
    sender_id: profile.userId,
    body: description,
    visibility: "customer",
  });
  if (message.error) throw new Error(message.error.message);
  return ticket;
}

export async function listMySupportTickets(): Promise<SupportTicket[]> {
  const profile = await getActiveFirmProfile();
  let restListError: unknown = null;
  const restTickets = await restRequest<SupportTicket[]>(
    `platform_support_tickets?select=id,ticket_no,subject,status,priority,created_at&requester_id=eq.${encodeURIComponent(
      profile.userId,
    )}&order=created_at.desc`,
  ).catch((error) => {
    restListError = error;
    return null;
  });
  if (restTickets) return restTickets;
  if (restListError) throw toError(restListError, "Could not load support tickets.");

  const rpcResult = await rpcWithFallback<SupportTicket[]>(
    () => supabase.rpc("list_my_support_tickets"),
    "Support ticket list",
  );
  if (!rpcResult.error) return (rpcResult.data ?? []) as SupportTicket[];

  const { data, error } = await supabase
    .from("platform_support_tickets")
    .select("id,ticket_no,subject,status,priority,created_at")
    .eq("requester_id", profile.userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SupportTicket[];
}

export async function getSupportThread(ticketId: string): Promise<SupportThread> {
  const profile = await getActiveFirmProfile();
  const restTickets = await restRequest<
    Array<SupportTicket & { firm_id: string; requester_id: string }>
  >(
    `platform_support_tickets?select=id,ticket_no,subject,status,priority,created_at,firm_id,requester_id&id=eq.${encodeURIComponent(
      ticketId,
    )}&firm_id=eq.${encodeURIComponent(profile.firmId)}&requester_id=eq.${encodeURIComponent(
      profile.userId,
    )}&limit=1`,
  ).catch(() => null);
  if (restTickets?.[0]) {
    const conversationId = await ensureConversation(ticketId, profile.firmId);
    const restMessages = await restRequest<
      Array<{
        id: string;
        body: string;
        status: string;
        created_at: string;
        sender_id: string | null;
      }>
    >(
      `platform_conversation_messages?select=id,body,status,created_at,sender_id&conversation_id=eq.${encodeURIComponent(
        conversationId,
      )}&visibility=eq.customer&order=created_at.asc`,
    ).catch(() => []);
    return {
      ticket: restTickets[0],
      messages: (restMessages ?? []).map((message) => ({
        id: message.id,
        body: message.body,
        status: message.status,
        created_at: message.created_at,
        sender: message.sender_id === profile.userId ? "customer" : "support",
      })),
    };
  }

  const rpcResult = await rpcWithFallback<SupportThread>(
    () => supabase.rpc("get_customer_support_thread", { p_ticket_id: ticketId }),
    "Support thread",
  );
  if (!rpcResult.error && rpcResult.data) return rpcResult.data as SupportThread;

  const ticketResult = await supabase
    .from("platform_support_tickets")
    .select("id,ticket_no,subject,status,priority,created_at,firm_id,requester_id")
    .eq("id", ticketId)
    .eq("firm_id", profile.firmId)
    .eq("requester_id", profile.userId)
    .single();
  if (ticketResult.error) throw new Error(rpcResult.error?.message || ticketResult.error.message);

  const conversationId = await ensureConversation(ticketId, profile.firmId);
  const messagesResult = await supabase
    .from("platform_conversation_messages")
    .select("id,body,status,created_at,sender_id")
    .eq("conversation_id", conversationId)
    .eq("visibility", "customer")
    .order("created_at", { ascending: true });
  if (messagesResult.error) throw new Error(messagesResult.error.message);

  return {
    ticket: ticketResult.data as SupportTicket,
    messages: (messagesResult.data ?? []).map((message: any) => ({
      id: message.id,
      body: message.body,
      status: message.status,
      created_at: message.created_at,
      sender: message.sender_id === profile.userId ? "customer" : "support",
    })),
  };
}

export async function replySupportTicket(ticketId: string, body: string): Promise<void> {
  const text = cleanBody(body);
  if (!text) throw new Error("Message cannot be blank.");

  const profile = await getActiveFirmProfile();
  const conversationId = await ensureConversation(ticketId, profile.firmId);
  const restMessage = await restRequest("platform_conversation_messages", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: profile.userId,
      body: text,
      visibility: "customer",
    }),
  }).catch(() => null);
  if (restMessage !== null) {
    await restRequest(
      `platform_support_tickets?id=eq.${encodeURIComponent(ticketId)}&status=in.(resolved,closed)`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "reopened" }),
      },
    ).catch(() => null);
    return;
  }

  const rpcResult = await rpcWithFallback<void>(
    () =>
      supabase.rpc("reply_customer_support_ticket", {
        p_ticket_id: ticketId,
        p_body: text,
      }),
    "Support reply",
  );
  if (!rpcResult.error) return;

  const { error } = await supabase.from("platform_conversation_messages").insert({
    conversation_id: conversationId,
    sender_id: profile.userId,
    body: text,
    visibility: "customer",
  });
  if (error) throw new Error(rpcResult.error?.message || error.message);
  await supabase
    .from("platform_support_tickets")
    .update({ status: "reopened" })
    .eq("id", ticketId)
    .in("status", ["resolved", "closed"]);
}
