/**
 * Communication Settings Store
 * Holds ProviderConfig[] per branch, persisted to Supabase app_settings[id="comm_configs"].
 * Falls back to localStorage (zustand persist) for offline access.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createRepository } from "@/lib/repositories/base-repository";
import type { ProviderConfig, ProviderType, CommChannel } from "./types";

const appSettingsRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "app_settings",
);

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// Default: deep-link WhatsApp for every branch. Email Automation is Coming
// Soon for Workshop V1.1 (see pilot-config.ts) — no email provider is
// auto-activated; the EmailProvider code is untouched and can still be added
// manually via Provider Settings once email ships.
function defaultConfigs(branchId: string): ProviderConfig[] {
  return [
    {
      id: makeId(),
      branchId,
      channel: "whatsapp",
      providerType: "whatsapp_deep_link",
      isActive: true,
      priority: 0,
      settings: {},
    },
  ];
}

function persistToDb(configs: ProviderConfig[]): void {
  // Original payload included the redundant `id` field inside the data blob
  // itself — preserved here for byte-identical stored shape (zero behavior change).
  void appSettingsRepository.saveAs("comm_configs", { id: "comm_configs", configs });
}

import { WHATSAPP_KEYS } from "./types";
import { WASENDER_DEFAULT_BASE_URL } from "./wasender-client";

interface WasenderConfigInput {
  enabled: boolean;
  baseUrl: string;
  session: string;
}

interface CommSettingsState {
  configs: ProviderConfig[];
  /** Get active providers for a branch+channel, sorted by priority */
  getActiveProviders(branchId: string, channel: CommChannel): ProviderConfig[];
  upsertConfig(config: ProviderConfig): void;
  removeConfig(id: string): void;
  ensureDefaults(branchId: string): void;
  /** WasenderAPI config for a branch (non-secret only — token lives in main). */
  getWasenderConfig(branchId: string): ProviderConfig | null;
  /**
   * Enable/disable WasenderAPI for a branch. When enabled it becomes the
   * primary WhatsApp provider (priority 0); the deep-link provider is kept as
   * a lower-priority fallback so the service falls through automatically if
   * WasenderAPI fails or is unavailable.
   */
  setWasender(branchId: string, input: WasenderConfigInput): void;
}

export const useCommSettings = create<CommSettingsState>()(
  persist(
    (set, get) => ({
      configs: [],

      getActiveProviders(branchId, channel) {
        return get()
          .configs.filter((c) => c.branchId === branchId && c.channel === channel && c.isActive)
          .sort((a, b) => a.priority - b.priority);
      },

      upsertConfig(config) {
        set((s) => {
          const idx = s.configs.findIndex((c) => c.id === config.id);
          let next: ProviderConfig[];
          if (idx >= 0) {
            next = [...s.configs];
            next[idx] = config;
          } else {
            next = [...s.configs, config];
          }
          persistToDb(next);
          return { configs: next };
        });
      },

      removeConfig(id) {
        set((s) => {
          const next = s.configs.filter((c) => c.id !== id);
          persistToDb(next);
          return { configs: next };
        });
      },

      ensureDefaults(branchId) {
        const existing = get().configs.filter((c) => c.branchId === branchId);
        if (existing.length === 0) {
          set((s) => {
            const next = [...s.configs, ...defaultConfigs(branchId)];
            persistToDb(next);
            return { configs: next };
          });
        }
      },

      getWasenderConfig(branchId) {
        return (
          get().configs.find(
            (c) => c.branchId === branchId && c.providerType === "whatsapp_wasender",
          ) ?? null
        );
      },

      setWasender(branchId, input) {
        set((s) => {
          let next = [...s.configs];

          // Upsert the WasenderAPI provider (primary, priority 0).
          const wIdx = next.findIndex(
            (c) => c.branchId === branchId && c.providerType === "whatsapp_wasender",
          );
          const wConfig: ProviderConfig = {
            id: wIdx >= 0 ? next[wIdx].id : makeId(),
            branchId,
            channel: "whatsapp",
            providerType: "whatsapp_wasender",
            isActive: input.enabled,
            priority: 0,
            settings: {
              [WHATSAPP_KEYS.apiBaseUrl]: input.baseUrl || WASENDER_DEFAULT_BASE_URL,
              [WHATSAPP_KEYS.wasenderSession]: input.session || "",
            },
          };
          if (wIdx >= 0) next[wIdx] = wConfig;
          else next.push(wConfig);

          // Guarantee a deep-link fallback at a lower priority so the service
          // always has somewhere to fall through to.
          const hasDeepLink = next.some(
            (c) => c.branchId === branchId && c.providerType === "whatsapp_deep_link",
          );
          if (!hasDeepLink) {
            next.push({
              id: makeId(),
              branchId,
              channel: "whatsapp",
              providerType: "whatsapp_deep_link",
              isActive: true,
              priority: 100,
              settings: {},
            });
          } else {
            next = next.map((c) =>
              c.branchId === branchId && c.providerType === "whatsapp_deep_link"
                ? { ...c, isActive: true, priority: Math.max(c.priority, 100) }
                : c,
            );
          }

          persistToDb(next);
          return { configs: next };
        });
      },
    }),
    { name: "mtj-comm-settings-v1" },
  ),
);
