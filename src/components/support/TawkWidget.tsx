import { useEffect } from "react";

/**
 * Free tawk.to chat widget (AVS-52).
 * Set VITE_TAWK_PROPERTY_ID + VITE_TAWK_WIDGET_ID in env to enable.
 * No-op when unset — never invent property IDs.
 */
export function TawkWidget() {
  const propertyId = (import.meta.env.VITE_TAWK_PROPERTY_ID as string | undefined)?.trim();
  const widgetId = (import.meta.env.VITE_TAWK_WIDGET_ID as string | undefined)?.trim() || "default";

  useEffect(() => {
    if (!propertyId) return;
    if (document.getElementById("tawk-script")) return;

    (window as any).Tawk_API = (window as any).Tawk_API || {};
    (window as any).Tawk_LoadStart = new Date();

    const s = document.createElement("script");
    s.id = "tawk-script";
    s.async = true;
    s.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    document.body.appendChild(s);

    return () => {
      s.remove();
    };
  }, [propertyId, widgetId]);

  return null;
}
