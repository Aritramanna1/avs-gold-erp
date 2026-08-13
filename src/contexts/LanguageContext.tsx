import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  englishDictionary,
  getLoadedDictionary,
  loadLanguageDictionary,
  LANGUAGE_INFO,
  type LanguageCode,
  type TranslationDictionary,
} from "@/i18n";
import { useSettings } from "@/lib/settings-store";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  /** True until the chosen non-English language has finished its dynamic import. */
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = "mtj-app-language";

function isLanguageCode(value: unknown): value is LanguageCode {
  return value === "en" || value === "hi" || value === "mr" || value === "bn";
}

function readInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (isLanguageCode(stored)) return stored;
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<LanguageCode>(readInitialLanguage);
  const [dict, setDict] = useState<TranslationDictionary>(() => getLoadedDictionary(language));
  const [loading, setLoading] = useState<boolean>(language !== "en");

  const settingsAppLang = useSettings((s) => s.language?.appLanguage);

  // Reflect Settings-store changes back into context (e.g. when restored from Supabase).
  useEffect(() => {
    if (settingsAppLang && isLanguageCode(settingsAppLang) && settingsAppLang !== language) {
      setLangState(settingsAppLang);
    }
  }, [settingsAppLang, language]);

  // Whenever the active language changes, fetch its dictionary (cached after the first load).
  useEffect(() => {
    let cancelled = false;
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    if (language === "en") {
      setDict(englishDictionary);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadLanguageDictionary(language)
      .then((next) => {
        if (cancelled) return;
        setDict(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to English silently so the UI never throws.
        setDict(englishDictionary);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((newLang: LanguageCode) => {
    if (!isLanguageCode(newLang)) return;
    // Only allow languages that are flagged enabled, unless a Super-Owner override is set.
    const allowBeta =
      typeof window !== "undefined" && window.sessionStorage.getItem("mtj-i18n-allow-beta") === "1";
    if (!LANGUAGE_INFO[newLang].enabled && !allowBeta) return;
    setLangState(newLang);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, newLang);
    }
    // Mirror into the persisted settings-store so other devices/sessions stay in sync.
    try {
      useSettings.getState().setLanguage({ appLanguage: newLang });
    } catch {
      // Settings store may not be hydrated yet — harmless.
    }
  }, []);

  /**
   * Translate `module.key` (or a bare `key` looked up across common/navigation/dashboard).
   * Strictly file-based, no runtime sentence matching.
   * Falls back to English; if still missing, humanises the key so the UI never shows blank.
   */
  const t = useCallback(
    (key: string): string => {
      if (!key) return "";
      const parts = key.split(".");

      if (parts.length === 2) {
        const [mod, subKey] = parts;
        const direct = dict[mod]?.[subKey];
        if (direct !== undefined) return direct;
        const fallback = englishDictionary[mod]?.[subKey];
        if (fallback !== undefined) return fallback;
      } else {
        // Bare key — search standard surfaces in a predictable order.
        const surfaces = ["common", "navigation", "dashboard"];
        for (const surface of surfaces) {
          const direct = dict[surface]?.[key];
          if (direct !== undefined) return direct;
        }
        for (const surface of surfaces) {
          const fallback = englishDictionary[surface]?.[key];
          if (fallback !== undefined) return fallback;
        }
      }

      const raw = parts.length === 2 ? parts[1] : key;
      const humanised = raw
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .trim();
      return humanised.charAt(0).toUpperCase() + humanised.slice(1);
    },
    [dict],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside <LanguageProvider />");
  }
  return ctx;
}
