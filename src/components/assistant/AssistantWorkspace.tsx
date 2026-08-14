import React, { useState, useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Trash2,
  Pin,
  Search,
  Plus,
  Bot,
  User,
  ExternalLink,
  Coins,
  ShieldCheck,
  ChevronRight,
  MoreVertical,
  Edit2,
  Archive,
  Info,
} from "lucide-react";
import type { AssistantMessage, ProviderAdapterConfig } from "@/lib/assistant/assistant-types";
import { processAssistantQuery } from "@/lib/assistant/ai-provider-service";
import { VoiceService } from "@/lib/assistant/voice-service";
import { Logo } from "@/components/ui/Logo";
import { getTenantCreditWallet, type TenantCreditWallet } from "@/lib/assistant/credit-engine";
import { AssistantCardRenderer } from "./AssistantCardRenderer";
import { useRoles } from "@/lib/rbac";
import { toast } from "sonner";

import { setRouteContext } from "@/lib/assistant/assistant-context-engine";

export interface ConversationSession {
  id: string;
  title: string;
  isPinned?: boolean;
  isArchived?: boolean;
  updatedAt: string;
  messages: AssistantMessage[];
}

const SESSIONS_STORAGE_KEY = "ornexa_assistant_workspace_sessions";

export function AssistantWorkspace() {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState("");
  const [inputQuery, setInputQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<
    "local" | "cloudflare_ai_gateway" | "openai" | "anthropic"
  >("local");
  const [wallet, setWallet] = useState<TenantCreditWallet>(getTenantCreditWallet());

  const { roles } = useRoles();
  const userRole = roles[0] || "Owner";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setRouteContext(pathname);
  }, [pathname]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceServiceRef = useRef<VoiceService | null>(null);

  // Initialize Sessions from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (raw) {
        const loaded: ConversationSession[] = JSON.parse(raw);
        if (loaded.length > 0) {
          setSessions(loaded);
          setActiveSessionId(loaded[0].id);
          return;
        }
      }
    } catch {
      // Ignore
    }

    // Default first session
    const initialSession: ConversationSession = {
      id: `conv_${Date.now()}`,
      title: "New ERP Session",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "msg_welcome",
          role: "assistant",
          content:
            "Welcome to the Ornexa Assistant Operating Workspace. You can query live gold balances, search inventory, draft expenses from invoices, check karigar custody, create support tickets, or ask for workflow guidance.",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      try {
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      } catch {
        // Ignore
      }
    }
  }, [sessions]);

  // Initialize Voice Service
  useEffect(() => {
    if (!voiceServiceRef.current) {
      voiceServiceRef.current = new VoiceService({
        onListeningStateChange: (listening) => setIsListening(listening),
        onSpeakingStateChange: (speaking) => setIsSpeaking(speaking),
        onTranscriptChange: (text, isFinal) => {
          setInputQuery(text);
          if (isFinal && text.trim()) {
            handleSendMessage(text);
          }
        },
      });
      voiceServiceRef.current.setSpeakerEnabled(speakerEnabled);
    }
  }, [speakerEnabled]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, isLoading]);

  const handleCreateNewSession = () => {
    voiceServiceRef.current?.stopSpeaking();
    const newSession: ConversationSession = {
      id: `conv_${Date.now()}`,
      title: "New Conversation",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content:
            "Started a fresh conversation. How can I assist you with your jewellery business operations?",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setSelectedFile(null);
    setInputQuery("");
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if ((!textToSend.trim() && !selectedFile) || isLoading || !activeSession) return;

    voiceServiceRef.current?.stopSpeaking();

    const userMsg: AssistantMessage = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content: textToSend.trim() || (selectedFile ? `Uploaded ${selectedFile.name}` : ""),
      createdAt: new Date().toISOString(),
    };

    const fileName = selectedFile?.name;
    setSelectedFile(null);
    setInputQuery("");

    const updatedMessages = [...activeSession.messages, userMsg];
    const updatedSessions = sessions.map((s) =>
      s.id === activeSession.id
        ? {
            ...s,
            title:
              s.title === "New Conversation" || s.title === "New ERP Session"
                ? textToSend.slice(0, 28)
                : s.title,
            updatedAt: new Date().toISOString(),
            messages: updatedMessages,
          }
        : s,
    );
    setSessions(updatedSessions);
    setIsLoading(true);

    const config: ProviderAdapterConfig = {
      provider: selectedProvider,
      model: selectedProvider === "local" ? "deterministic-v3" : "gemini-1.5-flash",
    };

    try {
      const response = await processAssistantQuery(
        textToSend.trim() || (fileName ? `Process ${fileName}` : ""),
        config,
        userRole,
        fileName,
        pathname,
      );

      const finalSessions = sessions.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              messages: [...updatedMessages, response],
              updatedAt: new Date().toISOString(),
            }
          : s,
      );
      setSessions(finalSessions);
      setWallet(getTenantCreditWallet());

      if (speakerEnabled && response.content) {
        voiceServiceRef.current?.speak(response.content);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePin = (sessionId: string) => {
    setSessions(sessions.map((s) => (s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s)));
  };

  const handleDeleteSession = (sessionId: string) => {
    if (sessions.length <= 1) {
      toast.error("Cannot delete the only remaining conversation.");
      return;
    }
    const filtered = sessions.filter((s) => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0]?.id || "");
    }
    toast.success("Conversation deleted.");
  };

  const filteredSessions = sessions
    .filter((s) => !s.isArchived)
    .filter((s) => s.title.toLowerCase().includes(searchFilter.toLowerCase()))
    .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-background text-foreground z-50 lg:z-auto">
      {/* 1. Left Conversation Sidebar */}
      <div className="hidden md:flex w-72 flex-col border-r border-border bg-card/60 backdrop-blur">
        <div className="p-3 border-b border-border/70 space-y-2.5">
          <button
            type="button"
            onClick={handleCreateNewSession}
            className="w-full h-9 rounded-sm bg-gold text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gold/90 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Conversation</span>
          </button>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-sm border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`group flex items-center justify-between p-2.5 rounded-sm text-xs cursor-pointer transition-all ${
                  isActive
                    ? "bg-gold/15 text-gold font-semibold border border-gold/30"
                    : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {session.isPinned && <Pin className="h-3 w-3 text-gold shrink-0" />}
                  <span className="truncate">{session.title}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(session.id);
                    }}
                    className="p-1 hover:text-gold"
                    title="Pin Conversation"
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    className="p-1 hover:text-red-500"
                    title="Delete Conversation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Credit Wallet Badge */}
        <div className="p-3 border-t border-border/70 bg-card/90">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Coins className="h-4 w-4 text-gold" />
              <span>Credit Wallet</span>
            </div>
            <span className="font-mono font-bold text-gold">{wallet.creditBalance}</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {wallet.consumedThisMonth} credits used this month (AI &amp; WhatsApp)
          </p>
        </div>
      </div>

      {/* 2. Main Conversational Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Workspace Top Header */}
        <div className="h-14 border-b border-border bg-card/40 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-sm bg-gold/10 text-gold flex items-center justify-center border border-gold/20 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif font-semibold text-sm truncate text-foreground">
                {activeSession?.title || "Ornexa Assistant Workspace"}
              </h3>
              <p className="text-[10px] text-muted-foreground truncate">
                Deterministic ERP Core &bull; Layer 1 Context Intelligence Active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Intelligence Mode Selector */}
            <div className="flex items-center rounded-sm border border-border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedProvider("local")}
                className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer font-medium ${
                  selectedProvider === "local"
                    ? "bg-gold text-black shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Standard (0 Cost)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedProvider("cloudflare_ai_gateway");
                  toast.info("Switched to Metered Cloud AI Mode");
                }}
                className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer font-medium ${
                  selectedProvider !== "local"
                    ? "bg-gold text-black shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Cloud AI (Metered)
              </button>
            </div>

            {/* Speaker Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !speakerEnabled;
                setSpeakerEnabled(next);
                voiceServiceRef.current?.setSpeakerEnabled(next);
              }}
              className={`p-2 rounded-sm border transition-colors cursor-pointer ${
                speakerEnabled
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              title={speakerEnabled ? "Voice Speaker Active" : "Voice Speaker Muted"}
            >
              {speakerEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {activeSession?.messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="h-8 w-8 rounded-sm bg-gold/10 text-gold flex items-center justify-center shrink-0 mt-0.5 border border-gold/20 shadow-xs">
                    <Logo variant="svg" className="h-4 w-4 object-contain grayscale opacity-80" />
                  </div>
                )}
                <div
                  className={`max-w-[88%] md:max-w-[78%] rounded-sm p-4 text-xs md:text-sm ${
                    isUser
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/70 text-foreground border border-border/70 shadow-xs"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {/* Rich ERP Card */}
                  {msg.erpCard && (
                    <AssistantCardRenderer
                      card={msg.erpCard}
                      onActionConfirmed={(actionId, result) => {
                        handleSendMessage(`Action ${actionId} confirmed: ${result}`);
                      }}
                    />
                  )}

                  <span className="block mt-2 text-[9px] text-muted-foreground/80 text-right">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {isUser && (
                  <div className="h-8 w-8 rounded-sm bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3.5 justify-start items-center">
              <div className="h-8 w-8 rounded-sm bg-gold/10 text-gold flex items-center justify-center shrink-0 border border-gold/20 shadow-xs">
                <Sparkles className="h-4 w-4 animate-spin" />
              </div>
              <div className="rounded-sm bg-muted/70 p-3.5 text-xs text-muted-foreground border border-border/70 flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-sm bg-gold animate-ping" />
                Querying authorized ERP ledgers &amp; knowledge base...
              </div>
              <button
                type="button"
                onClick={() => setIsLoading(false)}
                className="ml-2 h-8 px-3 rounded-sm border border-red-500/50 bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                Stop
              </button>
            </div>
          )}

          {activeSession?.messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mt-4 max-w-[85%] mx-auto justify-center">
              {[
                userRole.includes("owner") ? "Firm Net Gold Position" : null,
                userRole.includes("workshop")
                  ? "Pending Jobs assigned to Karigars"
                  : "Search ready 22k bangles",
                "Show outstanding receivables",
                "How do I issue gold to a Karigar?",
                "Create a support ticket",
              ]
                .filter(Boolean)
                .map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt!)}
                    className="px-3 py-1.5 rounded-sm border border-border/80 bg-card/50 hover:bg-gold/10 hover:border-gold/50 text-[11px] text-muted-foreground hover:text-foreground font-medium transition-all shadow-xs cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Multimodal Attachment Indicator */}
        {selectedFile && (
          <div className="mx-4 mb-2 p-2 rounded-sm border border-gold/40 bg-gold/5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gold" />
              <span className="font-semibold text-foreground">{selectedFile.name}</span>
              <span className="text-[10px] text-muted-foreground">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="text-muted-foreground hover:text-red-500 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Input Composer & Controls */}
        <div className="p-4 border-t border-border bg-card/80 backdrop-blur space-y-2">
          {isListening && (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-red-500 animate-pulse">
              <span className="h-2 w-2 rounded-sm bg-red-500 animate-ping" />
              Listening... Speak your query naturally (Speech-to-Text active)
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
              accept="image/*,.pdf,.csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 rounded-sm border border-border bg-background hover:border-gold/50 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer shadow-xs"
              title="Attach photo, invoice image, or PDF document"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={() => voiceServiceRef.current?.toggleListening()}
              className={`h-10 w-10 rounded-sm border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                isListening
                  ? "border-red-500 bg-red-500/10 text-red-500 animate-pulse"
                  : "border-border bg-background hover:border-gold/50 text-muted-foreground hover:text-foreground"
              }`}
              title={isListening ? "Stop Listening" : "Start Voice Input"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Query Input Box */}
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                selectedFile
                  ? `Add instruction for "${selectedFile.name}" (e.g. 'Create expense', 'Add to catalogue')...`
                  : "Ask Ornexa Assistant or attach documents..."
              }
              className="flex-1 h-10 rounded-sm border border-border bg-background px-4 text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold text-foreground placeholder:text-muted-foreground"
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={(!inputQuery.trim() && !selectedFile) || isLoading}
              className="h-10 px-4 rounded-sm bg-gold text-black font-semibold text-xs md:text-sm flex items-center gap-2 hover:bg-gold/90 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
