/**
 * Per-device Sound Effects ON/OFF. Local only — a quiet back-office laptop
 * should not inherit the shop-floor tablet's preference.
 */
import { create } from "zustand";

const STORAGE_KEY = "ornexa.soundEffects.enabled";

function readStored(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

interface UiSoundPreferenceState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useUiSoundPreference = create<UiSoundPreferenceState>()((set) => ({
  enabled: readStored(),
  setEnabled: (enabled) => {
    set({ enabled });
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* private mode */
    }
  },
}));

export function isSoundEffectsEnabled(): boolean {
  return useUiSoundPreference.getState().enabled;
}

export function setSoundEffectsEnabled(enabled: boolean): void {
  useUiSoundPreference.getState().setEnabled(enabled);
}
