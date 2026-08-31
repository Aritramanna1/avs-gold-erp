/**
 * WhatsApp Inbox Store — conversations + messages (Supabase-backed).
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";

export type ConversationStatus =
  | "open"
  | "unassigned"
  | "assigned"
  | "waiting_customer"
  | "waiting_internal"
  | "resolved"
  | "closed";

export type MessageDirection = "inbound" | "outbound" | "internal_note" | "system_event";

export interface WhatsAppConversation {
  id: string;
  firmId: string;
  productId: string;
  connectionId?: string;
  branchId?: string;
  partyId?: string;
  contactPhone: string;
  contactName?: string;
  status: ConversationStatus;
  assignedUserId?: string;
  assignedTeam?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageDirection?: MessageDirection;
  unreadCount: number;
  labels: string[];
  updatedAt: string;
}

export interface WhatsAppInboxMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  messageType: string;
  bodyText?: string;
  mediaUrl?: string;
  mediaFilename?: string;
  templateName?: string;
  status: string;
  senderType: string;
  senderUserId?: string;
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorMessage?: string;
  createdAt: string;
}

function mapConversation(row: Record<string, unknown>): WhatsAppConversation {
  return {
    id: String(row.id),
    firmId: String(row.firm_id),
    productId: String(row.product_id),
    connectionId: row.connection_id ? String(row.connection_id) : undefined,
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    partyId: row.party_id ? String(row.party_id) : undefined,
    contactPhone: String(row.contact_phone),
    contactName: row.contact_name ? String(row.contact_name) : undefined,
    status: String(row.status) as ConversationStatus,
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : undefined,
    assignedTeam: row.assigned_team ? String(row.assigned_team) : undefined,
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : undefined,
    lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : undefined,
    lastMessageDirection: row.last_message_direction as MessageDirection | undefined,
    unreadCount: Number(row.unread_count ?? 0),
    labels: Array.isArray(row.labels) ? (row.labels as string[]) : [],
    updatedAt: String(row.updated_at),
  };
}

function mapMessage(row: Record<string, unknown>): WhatsAppInboxMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    direction: String(row.direction) as MessageDirection,
    messageType: String(row.message_type ?? "text"),
    bodyText: row.body_text ? String(row.body_text) : undefined,
    mediaUrl: row.media_url ? String(row.media_url) : undefined,
    mediaFilename: row.media_filename ? String(row.media_filename) : undefined,
    templateName: row.template_name ? String(row.template_name) : undefined,
    status: String(row.status ?? "pending"),
    senderType: String(row.sender_type ?? "customer"),
    senderUserId: row.sender_user_id ? String(row.sender_user_id) : undefined,
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined,
    readAt: row.read_at ? String(row.read_at) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    createdAt: String(row.created_at),
  };
}

interface InboxState {
  conversations: WhatsAppConversation[];
  messages: WhatsAppInboxMessage[];
  selectedId: string | null;
  loading: boolean;
  messagesLoading: boolean;
  hydrate: (opts?: { productId?: string; status?: string }) => Promise<void>;
  selectConversation: (id: string | null) => Promise<void>;
  selectByPhone: (phone: string) => Promise<void>;
  sendReply: (conversationId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
  addInternalNote: (conversationId: string, note: string) => Promise<void>;
  assignConversation: (
    conversationId: string,
    userId: string | null,
    team?: string,
  ) => Promise<void>;
  updateStatus: (conversationId: string, status: ConversationStatus) => Promise<void>;
  markRead: (conversationId: string) => Promise<void>;
  subscribeRealtime: (firmId: string) => () => void;
}

export const useWhatsAppInboxStore = create<InboxState>()((set, get) => ({
  conversations: [],
  messages: [],
  selectedId: null,
  loading: false,
  messagesLoading: false,

  hydrate: async (opts) => {
    set({ loading: true });
    let query = supabase
      .from("whatsapp_conversations" as never)
      .select("*")
      .eq("product_id", opts?.productId ?? DEFAULT_AVS_PRODUCT)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (opts?.status) query = query.eq("status", opts.status);
    const { data, error } = await query;
    if (!error && data) {
      set({ conversations: (data as Record<string, unknown>[]).map(mapConversation) });
    }
    set({ loading: false });
  },

  selectConversation: async (id) => {
    set({ selectedId: id, messages: [], messagesLoading: Boolean(id) });
    if (!id) return;
    const { data, error } = await supabase
      .from("whatsapp_messages" as never)
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (!error && data) {
      set({
        messages: (data as Record<string, unknown>[]).map(mapMessage),
        messagesLoading: false,
      });
    } else {
      set({ messagesLoading: false });
    }
    await get().markRead(id);
  },

  selectByPhone: async (phone) => {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const existing = get().conversations.find((c) =>
      c.contactPhone.replace(/\D/g, "").endsWith(digits),
    );
    if (existing) {
      await get().selectConversation(existing.id);
      return;
    }
    const { data } = await supabase
      .from("whatsapp_conversations" as never)
      .select("id")
      .ilike("contact_phone", `%${digits}`)
      .maybeSingle();
    if (data) {
      await get().selectConversation(String((data as { id: string }).id));
    }
  },

  sendReply: async (conversationId, text) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return { ok: false, error: "Conversation not found" };

    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!url || !token) return { ok: false, error: "Sign in required" };

    const res = await fetch(`${url}/functions/v1/send-whatsapp-inbox-reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        phone: conv.contactPhone,
        message: text,
        branchId: conv.branchId,
      }),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string; messageId?: string };
    if (!res.ok) return { ok: false, error: body.error ?? "Send failed" };
    await get().selectConversation(conversationId);
    await get().hydrate();
    return { ok: true };
  },

  addInternalNote: async (conversationId, note) => {
    const { data: profile } = await supabase
      .from("user_profiles" as never)
      .select("firm_id")
      .maybeSingle();
    const firmId = (profile as { firm_id?: string } | null)?.firm_id;
    if (!firmId) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("whatsapp_messages" as never).insert({
      firm_id: firmId,
      product_id: DEFAULT_AVS_PRODUCT,
      conversation_id: conversationId,
      direction: "internal_note",
      message_type: "text",
      body_text: note,
      status: "received",
      sender_type: "agent",
      sender_user_id: userData.user?.id ?? null,
    } as never);
    await get().selectConversation(conversationId);
  },

  assignConversation: async (conversationId, userId, team) => {
    await supabase
      .from("whatsapp_conversations" as never)
      .update({
        assigned_user_id: userId,
        assigned_team: team ?? null,
        status: userId || team ? "assigned" : "unassigned",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", conversationId);
    await supabase.from("conversation_assignments" as never).insert({
      conversation_id: conversationId,
      assigned_to_user_id: userId,
      assigned_to_team: team ?? null,
    } as never);
    await get().hydrate();
  },

  updateStatus: async (conversationId, status) => {
    await supabase
      .from("whatsapp_conversations" as never)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", conversationId);
    await get().hydrate();
  },

  markRead: async (conversationId) => {
    await supabase
      .from("whatsapp_conversations" as never)
      .update({ unread_count: 0, updated_at: new Date().toISOString() } as never)
      .eq("id", conversationId);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    }));
  },

  subscribeRealtime: (firmId) => {
    const channel = supabase
      .channel(`wa-inbox-${firmId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `firm_id=eq.${firmId}`,
        },
        () => {
          void get().hydrate();
          const sel = get().selectedId;
          if (sel) void get().selectConversation(sel);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_conversations",
          filter: `firm_id=eq.${firmId}`,
        },
        () => void get().hydrate(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },
}));
