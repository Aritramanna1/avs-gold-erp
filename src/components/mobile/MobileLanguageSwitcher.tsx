import { ALL_LANGUAGES, LANGUAGE_INFO, type LanguageCode } from "@/i18n";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticLight } from "@/lib/native/haptics";

/**
 * Compact app-language control for mobile More / Account.
 * Uses the same LanguageContext as the header switcher.
 */
export function MobileLanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={className} data-testid="mobile-language-switcher">
      <label
        htmlFor="mobile-lang-select"
        className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block"
      >
        {t("mobile.appLanguage")}
      </label>
      <select
        id="mobile-lang-select"
        value={language}
        className="min-h-[var(--touch-target)] w-full rounded-md border border-input bg-background px-3 text-sm"
        onChange={(e) => {
          void hapticLight();
          setLanguage(e.target.value as LanguageCode);
        }}
      >
        {ALL_LANGUAGES.map((code) => {
          const info = LANGUAGE_INFO[code];
          return (
            <option key={code} value={code} disabled={!info.enabled}>
              {info.native} ({info.label})
            </option>
          );
        })}
      </select>
    </div>
  );
}
