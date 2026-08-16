/**
 * Cookie & privacy consent preferences (GDPR / ePrivacy / app-store readiness).
 * Persists locally; analytics loads only after explicit opt-in.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConsentCategory = "essential" | "functional" | "analytics" | "marketing";

export interface ConsentPreferences {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string | null;
  policyVersion: string;
}

const POLICY_VERSION = "2026-08-15";

interface ConsentState {
  preferences: ConsentPreferences;
  bannerDismissed: boolean;
  hasDecided: () => boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  updatePreferences: (patch: Partial<Omit<ConsentPreferences, "essential">>) => void;
  recordSignupConsent: (opts: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    marketingOptIn?: boolean;
  }) => void;
  signupConsent: {
    termsAcceptedAt: string | null;
    privacyAcceptedAt: string | null;
    marketingOptIn: boolean;
  };
}

const defaultPreferences: ConsentPreferences = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
  decidedAt: null,
  policyVersion: POLICY_VERSION,
};

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,
      bannerDismissed: false,
      signupConsent: {
        termsAcceptedAt: null,
        privacyAcceptedAt: null,
        marketingOptIn: false,
      },
      hasDecided: () => {
        const p = get().preferences;
        return p.decidedAt !== null && p.policyVersion === POLICY_VERSION;
      },
      acceptAll: () =>
        set({
          preferences: {
            essential: true,
            functional: true,
            analytics: true,
            marketing: true,
            decidedAt: new Date().toISOString(),
            policyVersion: POLICY_VERSION,
          },
          bannerDismissed: true,
        }),
      rejectNonEssential: () =>
        set({
          preferences: {
            essential: true,
            functional: true,
            analytics: false,
            marketing: false,
            decidedAt: new Date().toISOString(),
            policyVersion: POLICY_VERSION,
          },
          bannerDismissed: true,
        }),
      updatePreferences: (patch) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...patch,
            essential: true,
            decidedAt: new Date().toISOString(),
            policyVersion: POLICY_VERSION,
          },
          bannerDismissed: true,
        })),
      recordSignupConsent: ({ termsAccepted, privacyAccepted, marketingOptIn = false }) => {
        const now = new Date().toISOString();
        set({
          signupConsent: {
            termsAcceptedAt: termsAccepted ? now : null,
            privacyAcceptedAt: privacyAccepted ? now : null,
            marketingOptIn,
          },
        });
        if (marketingOptIn) {
          get().updatePreferences({ marketing: true });
        }
      },
    }),
    { name: "ornexa-consent-preferences-v1" },
  ),
);

export const CURRENT_POLICY_VERSION = POLICY_VERSION;
