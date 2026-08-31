import { useEffect } from "react";
import { useSettings } from "@/lib/settings-store";

/** Applies the operator-configured brand palette and browser identity at runtime. */
export function BrandRuntime() {
  const branding = useSettings((state) => state.branding);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", branding.primaryColor);
    root.style.setProperty(
      "--primary-hover",
      `color-mix(in srgb, ${branding.primaryColor} 82%, black)`,
    );
    root.style.setProperty("--gold", branding.goldAccent);
    root.style.setProperty(
      "--gold-soft",
      `color-mix(in srgb, ${branding.goldAccent} 18%, transparent)`,
    );
    root.style.setProperty("--gold-deep", `color-mix(in srgb, ${branding.goldAccent} 72%, black)`);

    const description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      document.head.appendChild(
        Object.assign(document.createElement("meta"), { name: "description" }),
      );
    description.content = branding.description;
  }, [branding]);

  return null;
}
