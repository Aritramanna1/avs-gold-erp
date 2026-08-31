import React, { useState, useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Trash2,
  CornerDownLeft,
  Bot,
  User,
  ShieldCheck,
  TrendingUp,
  Hammer,
  Receipt,
  Users,
  Package,
} from "lucide-react";
import type { AssistantMessage, ProviderAdapterConfig } from "@/lib/assistant/assistant-types";
import { processAssistantQuery, getTodayUsageMetrics } from "@/lib/assistant/ai-provider-service";
import { VoiceService } from "@/lib/assistant/voice-service";
import { AssistantCardRenderer } from "./AssistantCardRenderer";
import { Logo } from "@/components/ui/Logo";
import { useRoles } from "@/lib/rbac";
import { useSettings } from "@/lib/settings-store";
import { KEYBOARD_EVENTS } from "@/lib/keyboard/keyboard-events";
import { useShortcutBindings } from "@/lib/keyboard/use-shortcut-binding";
import { getShortcutDisplayLabel } from "@/lib/keyboard/shortcut-keys";

const CONVERSATION_STORAGE_KEY = "ornexa_assistant_chat_history";

export function AssistantDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  const { roles } = useRoles();
  const currentUserRole = useSettings((s) => s.currentUserRole);
  const branding = useSettings((s) => s.branding);
  const userRole = currentUserRole || roles[0] || "Owner";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceServiceRef = useRef<VoiceService | null>(null);

  // Lazy-load voice service only when Assistant drawer is opened
  useEffect(() => {
    if (isOpen && !voiceServiceRef.current) {
      voiceServiceRef.current = new VoiceService({
        onListeningStateChange: (listening) => setIsListening(listening),
        onSpeakingStateChange: (speaking) => setIsSpeaking(speaking),
        onTranscriptChange: (text, isFinal) => {
          setInputQuery(text);
          if (isFinal && text.trim()) {
            handleSendQuery(text);
          }
        },
      });
      voiceServiceRef.current.setSpeakerEnabled(speakerEnabled);
    }
  }, [isOpen, speakerEnabled]);

  // Load chat history from localStorage on open
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(CONVERSATION_STORAGE_KEY);
        if (saved) {
          setMessages(JSON.parse(saved));
        } else {
          // Default initial greeting
          setMessages([
            {
              id: "msg_welcome",
              role: "assistant",
              content:
                "Hello! I am your permission-aware Ornexa ERP Assistant. Ask me about gold positions, worker custody, customer balances, job stages, ready stock, or receivables ageing.",
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        // Ignore
      }
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useShortcutBindings(["nav_assistant_quick", "nav_assistant"], () => {
    setIsOpen((prev) => !prev);
  });

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener(KEYBOARD_EVENTS.ASSISTANT_OPEN, handleOpen);
    return () => window.removeEventListener(KEYBOARD_EVENTS.ASSISTANT_OPEN, handleOpen);
  }, []);

  const assistantKeys = getShortcutDisplayLabel("nav_assistant_quick", "Ctrl+J");

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    // Instant interruption: stop any active voice speech
    voiceServiceRef.current?.stopSpeaking();

    const userMsg: AssistantMessage = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content: textToSend.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputQuery("");
    setIsLoading(true);

    const config: ProviderAdapterConfig = {
      provider: "local",
      model: "deterministic-v3",
    };

    try {
      const response = await processAssistantQuery(textToSend.trim(), config, userRole);
      const newMessages = [...updatedMessages, response];
      setMessages(newMessages);

      try {
        localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(newMessages.slice(-25)));
      } catch {
        // Ignore storage full
      }

      // Voice output if speaker is active
      if (speakerEnabled && response.content) {
        voiceServiceRef.current?.speak(response.content);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    voiceServiceRef.current?.stopSpeaking();
    setMessages([
      {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Conversation history cleared. How can I assist you with your ERP data?",
        createdAt: new Date().toISOString(),
      },
    ]);
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  };

  const toggleMic = () => {
    voiceServiceRef.current?.toggleListening();
  };

  const toggleSpeaker = () => {
    const nextState = !speakerEnabled;
    setSpeakerEnabled(nextState);
    voiceServiceRef.current?.setSpeakerEnabled(nextState);
  };

  // Route-aware smart suggestions
  const getContextChips = () => {
    if (pathname.includes("/workshop")) {
      return [
        { label: "Overdue Jobs", query: "Show overdue jobs" },
        { label: "Worker Gold Book", query: "Show karigar gold balance" },
        { label: "Where is my gold?", query: "Where is my gold?" },
      ];
    }
    if (pathname.includes("/billing")) {
      return [
        { label: "Receivables Ageing", query: "Show outstanding receivables ageing" },
        { label: "Recent Invoices", query: "Search recent invoices" },
        { label: "Document Register", query: "Show document register" },
      ];
    }
    if (pathname.includes("/people")) {
      return [
        { label: "Customer Dossier", query: "Customer balance for Raj" },
        { label: "Search Karigars", query: "Search karigar Ramesh" },
        { label: "Party Balances", query: "Show party outstanding" },
      ];
    }
    if (pathname.includes("/stock")) {
      return [
        { label: "22K Bangles", query: "Search ready 22k bangles" },
        { label: "Showroom Gold", query: "Where is my gold?" },
        { label: "Inventory Exceptions", query: "Show inventory exceptions" },
      ];
    }
    return [
      { label: "Where is my Gold?", query: "Where is my gold?" },
      { label: "Firm Gold Position", query: "Show firm net gold position" },
      { label: "Receivables Ageing", query: "Show receivables ageing" },
      { label: "Manufacturing Queue", query: "Show production jobs" },
    ];
  };

  return (
    <>
      {/* Global AI Assistant Trigger Button in Header / App (controlled via custom event or state) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => {
            voiceServiceRef.current?.stopSpeaking();
            setIsOpen(false);
          }}
        />
      )}

      {/* Slide-in Drawer */}
      <div
        id="ornexa-assistant-drawer"
        className={`fixed top-0 right-0 z-50 h-dvh max-h-dvh w-full sm:w-[480px] lg:w-[520px] bg-background border-l border-border shadow-2xl flex flex-col min-h-0 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header — fixed within drawer */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-sm bg-gold/10 text-gold flex items-center justify-center border border-gold/20 shadow-xs">
              <Logo className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-semibold text-sm text-foreground">
                  {branding.applicationName || "Ornexa"} Assistant
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Deterministic Core
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Permission-Aware Business Intelligence ({assistantKeys})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speaker Audio Toggle */}
            <button
              type="button"
              onClick={toggleSpeaker}
              className={`p-2 rounded-sm border transition-colors cursor-pointer ${
                speakerEnabled
                  ? "border-gold/40 bg-gold/5 text-gold"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              title={speakerEnabled ? "Voice Output Active" : "Voice Output Muted"}
            >
              {speakerEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Clear History */}
            <button
              type="button"
              onClick={handleClearHistory}
              className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Clear Conversation"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {/* Close Drawer */}
            <button
              type="button"
              onClick={() => {
                voiceServiceRef.current?.stopSpeaking();
                setIsOpen(false);
              }}
              className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close Assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conversation — independently scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm overscroll-contain">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="h-7 w-7 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0 mt-0.5 border border-gold/20 overflow-hidden">
                    <Logo className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-sm px-3.5 py-2.5 text-xs sm:text-sm ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-tr-xs"
                      : "bg-muted/70 text-foreground border border-border/60 rounded-tl-xs"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {msg.knowledgeSources && msg.knowledgeSources.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-border/50 flex flex-wrap gap-1">
                      {msg.knowledgeSources.slice(0, 2).map((src) => (
                        <span
                          key={src.id}
                          className="text-[9px] text-amber-600/80 border border-amber-500/15 bg-amber-500/5 rounded-sm px-1 py-0.5"
                          title={src.sourceDoc}
                        >
                          {src.title.length > 28 ? src.title.slice(0, 26) + "…" : src.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Rich ERP Card */}
                  {msg.erpCard && (
                    <AssistantCardRenderer
                      card={msg.erpCard}
                      onActionConfirmed={(actionId, message) => {
                        handleSendQuery(`Action ${actionId} confirmed: ${message}`);
                      }}
                    />
                  )}

                  <span className="block mt-1.5 text-[9px] text-muted-foreground/80 text-right">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {isUser && (
                  <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-3 mt-4">
              <div className="h-7 w-7 rounded-sm bg-gold/10 text-gold flex items-center justify-center shrink-0 border border-gold/20">
                <Logo className="h-4 w-4 animate-pulse" />
              </div>
              <div className="rounded-sm rounded-tl-xs bg-muted/70 px-3.5 py-2.5 text-xs text-muted-foreground border border-border/60 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gold animate-ping" />
                Querying authorized ERP ledgers...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick chips + composer — anchored at bottom */}
        <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur">
          <div className="px-4 py-2 border-b border-border/60 bg-card/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0">
              Quick:
            </span>
            {getContextChips().map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendQuery(chip.query)}
                className="shrink-0 px-2.5 py-1 rounded-full border border-border bg-background hover:border-gold/50 hover:bg-gold/5 text-[11px] text-foreground font-medium transition-colors cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-border bg-card/80 backdrop-blur space-y-2">
            {isListening && (
              <div className="flex items-center justify-center gap-2 py-1 text-xs font-semibold text-red-500 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                Listening... Speak your business query now
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleMic}
                className={`h-9 w-9 rounded-sm border flex items-center justify-center transition-all cursor-pointer ${
                  isListening
                    ? "border-red-500 bg-red-500/10 text-red-500 shadow-md animate-pulse"
                    : "border-border hover:border-gold/50 text-muted-foreground hover:text-foreground bg-background"
                }`}
                title={isListening ? "Stop listening" : "Start Voice Input"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendQuery();
                  }
                }}
                placeholder="Ask Assistant: 'Where is my gold?', 'Overdue jobs'..."
                className="flex-1 h-9 rounded-sm border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold text-foreground"
              />

              <button
                type="button"
                onClick={() => handleSendQuery()}
                disabled={!inputQuery.trim() || isLoading}
                className="h-9 px-3 rounded-sm bg-gold text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-gold/90 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Global Helper to Trigger Assistant Drawer Open */
export function openOrnexaAssistant() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(KEYBOARD_EVENTS.ASSISTANT_OPEN));
  }
}
