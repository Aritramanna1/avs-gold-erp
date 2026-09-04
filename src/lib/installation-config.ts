import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type DeploymentMode = "local" | "internet";

export interface CloudflareTunnelConfig {
  enabled: boolean;
  tunnelId?: string;
  tunnelName?: string;
  hostname?: string;
  localService: string; // e.g. "http://localhost:8000"
  httpsRequired: boolean;
  status?: "active" | "inactive" | "pending" | "unconfigured";
}

export interface ActivePortalsConfig {
  customer: boolean;
  karigar: boolean;
  supplier: boolean;
  carrier: boolean;
}

export interface AuthoritativeBusinessProfile {
  shopName: string;
  legalName: string;
  tradeName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  pan: string;
  logoUrl?: string;
  website?: string;
}

export interface InstallationConfigState {
  isSetupCompleted: boolean;
  deploymentMode: DeploymentMode;
  cloudflareTunnel: CloudflareTunnelConfig;
  activePortals: ActivePortalsConfig;
  businessProfile: AuthoritativeBusinessProfile;
  lastUpdated: string | null;
  isLoading: boolean;

  // Actions
  setDeploymentMode: (mode: DeploymentMode) => void;
  setCloudflareTunnel: (config: Partial<CloudflareTunnelConfig>) => void;
  setPortalStatus: (portal: keyof ActivePortalsConfig, enabled: boolean) => void;
  setAllPortals: (portals: Partial<ActivePortalsConfig>) => void;
  setBusinessProfile: (profile: Partial<AuthoritativeBusinessProfile>) => void;
  markSetupCompleted: (completed?: boolean) => void;
  saveInstallationConfig: () => Promise<{ ok: boolean; error?: string }>;
  loadInstallationConfig: () => Promise<void>;
}

const STORAGE_KEY = "ornexa_installation_config_v1";

const DEFAULT_INSTALLATION_CONFIG: Omit<
  InstallationConfigState,
  | "setDeploymentMode"
  | "setCloudflareTunnel"
  | "setPortalStatus"
  | "setAllPortals"
  | "setBusinessProfile"
  | "markSetupCompleted"
  | "saveInstallationConfig"
  | "loadInstallationConfig"
> = {
  isSetupCompleted: true, // Default to true for existing provisioned installations
  deploymentMode: "local",
  cloudflareTunnel: {
    enabled: false,
    localService: "http://localhost:3000",
    httpsRequired: true,
    status: "inactive",
  },
  activePortals: {
    customer: true,
    karigar: true,
    supplier: true,
    carrier: false,
  },
  businessProfile: {
    shopName: "MTJ / AVS Gold & Diamond Jewellers",
    legalName: "MTJ AVS JEWELLERS PRIVATE LIMITED",
    tradeName: "MTJ / AVS Gold & Diamond Jewellers",
    address: "123 Swarna Bazzar, Jewellers Lane, Mumbai, MH 400002",
    phone: "+91 98765 43210",
    email: "contact@mtjgold.example",
    gstin: "27AAACM1234F1Z5",
    pan: "AAACM1234F",
    logoUrl: "",
    website: "",
  },
  lastUpdated: new Date().toISOString(),
  isLoading: false,
};

function getInitialConfig() {
  if (typeof window === "undefined") return DEFAULT_INSTALLATION_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_INSTALLATION_CONFIG,
        ...parsed,
        isLoading: false,
      };
    }
  } catch (err) {
    console.warn("[installation-config] Failed to read from localStorage:", err);
  }
  return DEFAULT_INSTALLATION_CONFIG;
}

export const useInstallationConfig = create<InstallationConfigState>((set, get) => ({
  ...getInitialConfig(),

  setDeploymentMode: (deploymentMode) => {
    set({ deploymentMode });
    persistToLocal(get());
  },

  setCloudflareTunnel: (config) => {
    set((state) => ({
      cloudflareTunnel: { ...state.cloudflareTunnel, ...config },
    }));
    persistToLocal(get());
  },

  setPortalStatus: (portal, enabled) => {
    set((state) => ({
      activePortals: { ...state.activePortals, [portal]: enabled },
    }));
    persistToLocal(get());
  },

  setAllPortals: (portals) => {
    set((state) => ({
      activePortals: { ...state.activePortals, ...portals },
    }));
    persistToLocal(get());
  },

  setBusinessProfile: (profile) => {
    set((state) => ({
      businessProfile: { ...state.businessProfile, ...profile },
    }));
    persistToLocal(get());
  },

  markSetupCompleted: (completed = true) => {
    set({ isSetupCompleted: completed });
    persistToLocal(get());
  },

  saveInstallationConfig: async () => {
    const state = get();
    const payload = {
      is_setup_completed: state.isSetupCompleted,
      deployment_mode: state.deploymentMode,
      cloudflare_tunnel: state.cloudflareTunnel,
      active_portals: state.activePortals,
      business_profile: state.businessProfile,
      last_updated: new Date().toISOString(),
    };

    // Save to local storage cache immediately
    persistToLocal({ ...state, lastUpdated: payload.last_updated });

    try {
      // Persist to Supabase database app_settings
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id")
        .limit(1)
        .maybeSingle();

      const firmId =
        (orgData as { id?: string } | null)?.id ?? "00000000-0000-0000-0000-000000000001";

      const { error } = await supabase.from("app_settings").upsert(
        {
          id: firmId,
          data: {
            installation_config: payload,
          },
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "id" },
      );

      if (error) {
        console.warn(
          "[installation-config] DB persist error (fallback to local cache):",
          error.message,
        );
      }

      // Also update organization authoritative name & metadata
      await supabase
        .from("organizations")
        .update({
          name: state.businessProfile.shopName || state.businessProfile.tradeName,
          legal_name: state.businessProfile.legalName,
          gstin: state.businessProfile.gstin,
          pan: state.businessProfile.pan,
          address: state.businessProfile.address,
          phone: state.businessProfile.phone,
          email: state.businessProfile.email,
          logo_url: state.businessProfile.logoUrl || null,
        } as never)
        .eq("id", firmId);

      set({ lastUpdated: payload.last_updated });
      return { ok: true };
    } catch (err) {
      console.warn("[installation-config] Exception saving to DB:", err);
      return { ok: true }; // Local cache guarantees uninterrupted local operation
    }
  },

  loadInstallationConfig: async () => {
    set({ isLoading: true });
    try {
      const { data: orgData } = await (supabase.from("organizations") as any)
        .select("id, name, logo_url")
        .limit(1)
        .maybeSingle();

      const firmId =
        (orgData as { id?: string } | null)?.id ?? "00000000-0000-0000-0000-000000000001";

      const { data: settingsRow } = await supabase
        .from("app_settings")
        .select("data")
        .eq("id", firmId)
        .maybeSingle();

      const remoteData = (
        settingsRow as { data?: { installation_config?: Partial<InstallationConfigState> } } | null
      )?.data?.installation_config;

      if (remoteData) {
        set((state) => ({
          isSetupCompleted: remoteData.isSetupCompleted ?? state.isSetupCompleted,
          deploymentMode: remoteData.deploymentMode ?? state.deploymentMode,
          cloudflareTunnel: remoteData.cloudflareTunnel ?? state.cloudflareTunnel,
          activePortals: remoteData.activePortals ?? state.activePortals,
          businessProfile: {
            ...state.businessProfile,
            ...(remoteData.businessProfile || {}),
            shopName: orgData?.name || remoteData.businessProfile?.shopName || state.businessProfile.shopName,
          },
          lastUpdated: (remoteData as any).last_updated || new Date().toISOString(),
          isLoading: false,
        }));
        persistToLocal(get());
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn("[installation-config] Load error (using local cache):", err);
      set({ isLoading: false });
    }
  },
}));

function persistToLocal(state: InstallationConfigState) {
  if (typeof window === "undefined") return;
  try {
    const data = {
      isSetupCompleted: state.isSetupCompleted,
      deploymentMode: state.deploymentMode,
      cloudflareTunnel: state.cloudflareTunnel,
      activePortals: state.activePortals,
      businessProfile: state.businessProfile,
      lastUpdated: state.lastUpdated,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[installation-config] Failed to write localStorage:", err);
  }
}
