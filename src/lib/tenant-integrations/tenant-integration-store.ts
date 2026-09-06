/**
 * Arivahly Venture Sphere (AVS) — Multi-Tenant Integration Store
 * 
 * Reactive state management for tenant integration configurations.
 */

import { create } from "zustand";
import type {
  IntegrationType,
  TenantIntegrationRecord,
  TenantAIConfig,
  TenantWhatsAppConfig,
  TenantEmailConfig,
  TenantSMSConfig,
  TenantPaymentConfig,
} from "./tenant-integration-types";
import {
  getTenantIntegration,
  saveTenantIntegration,
  disconnectTenantIntegration,
  resolveActiveCredentials,
  canTenantSendWhatsApp,
  isFlagshipMTJTenant,
} from "./tenant-integration-service";

interface TenantIntegrationState {
  currentTenantId: string;
  integrations: Partial<Record<IntegrationType, TenantIntegrationRecord<any>>>;
  setCurrentTenantId: (tenantId: string) => void;
  loadTenantIntegrations: (tenantId?: string) => void;
  saveAIIntegration: (config: TenantAIConfig) => void;
  saveWhatsAppIntegration: (config: TenantWhatsAppConfig) => void;
  saveEmailIntegration: (config: TenantEmailConfig) => void;
  savePaymentIntegration: (config: TenantPaymentConfig) => void;
  disconnectIntegration: (type: IntegrationType) => void;
  canSendWhatsApp: () => { allowed: boolean; reason?: string };
}

export const useTenantIntegrations = create<TenantIntegrationState>((set, get) => ({
  currentTenantId: "tenant_default",
  integrations: {},

  setCurrentTenantId: (tenantId: string) => {
    set({ currentTenantId: tenantId });
    get().loadTenantIntegrations(tenantId);
  },

  loadTenantIntegrations: (tenantId?: string) => {
    const tid = tenantId || get().currentTenantId;
    const types: IntegrationType[] = ["ai", "whatsapp", "email", "sms", "payment"];
    const loaded: Partial<Record<IntegrationType, TenantIntegrationRecord<any>>> = {};

    for (const t of types) {
      const rec = getTenantIntegration(tid, t);
      if (rec) {
        loaded[t] = rec;
      }
    }

    set({ integrations: loaded });
  },

  saveAIIntegration: (config: TenantAIConfig) => {
    const tid = get().currentTenantId;
    const rec = saveTenantIntegration(tid, "ai", config);
    set((state) => ({
      integrations: { ...state.integrations, ai: rec },
    }));
  },

  saveWhatsAppIntegration: (config: TenantWhatsAppConfig) => {
    const tid = get().currentTenantId;
    const rec = saveTenantIntegration(tid, "whatsapp", config);
    set((state) => ({
      integrations: { ...state.integrations, whatsapp: rec },
    }));
  },

  saveEmailIntegration: (config: TenantEmailConfig) => {
    const tid = get().currentTenantId;
    const rec = saveTenantIntegration(tid, "email", config);
    set((state) => ({
      integrations: { ...state.integrations, email: rec },
    }));
  },

  savePaymentIntegration: (config: TenantPaymentConfig) => {
    const tid = get().currentTenantId;
    const rec = saveTenantIntegration(tid, "payment", config);
    set((state) => ({
      integrations: { ...state.integrations, payment: rec },
    }));
  },

  disconnectIntegration: (type: IntegrationType) => {
    const tid = get().currentTenantId;
    disconnectTenantIntegration(tid, type);
    set((state) => {
      const next = { ...state.integrations };
      delete next[type];
      return { integrations: next };
    });
  },

  canSendWhatsApp: () => {
    const tid = get().currentTenantId;
    return canTenantSendWhatsApp(tid);
  },
}));
