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

// Default: deep-link WhatsApp + SMTP email for every branch
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
    {
      id: makeId(),
      branchId,
      channel: "email",
      providerType: "email_smtp",
      isActive: true,
      priority: 0,
      settings: {
        from_email: "",
        from_name: "",
        host: "smtp.hostinger.com",
        port: "465",
        use_ssl: "true",
      },
    },
  ];
}

function persistToDb(configs: ProviderConfig[]): void {
  // Original payload included the redundant `id` field inside the data blob
  // itself — preserved here for byte-identical stored shape (zero behavior change).
  void appSettingsRepository.saveAs("comm_configs", { id: "comm_configs", configs });
}

interface CommSettingsState {
  configs: ProviderConfig[];
  /** Get active providers for a branch+channel, sorted by priority */
  getActiveProviders(branchId: string, channel: CommChannel): ProviderConfig[];
  upsertConfig(config: ProviderConfig): void;
  removeConfig(id: string): void;
  ensureDefaults(branchId: string): void;
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
    }),
    { name: "mtj-comm-settings-v1" },
  ),
);
