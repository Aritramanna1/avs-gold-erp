/**
 * Bounded scroll shell for native auth screens.
 * body.ornexa-native-app is overflow:hidden — pages must use h-dvh + inner scroller.
 */
import type { ReactNode } from "react";
import { APP_NAME, APP_PARENT_ATTRIBUTION, APP_TAGLINE } from "@/lib/app-info";
import { cn } from "@/lib/utils";
import { publicAsset } from "@/lib/native/public-asset";

export const AUTH_NATIVE_INPUT_CLS =
  "bg-black/40 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-[#B89454]/40";

/** Alias kept for AuthLayout and older call sites. */
export const nativeAuthInputClassName = AUTH_NATIVE_INPUT_CLS;

/** Bounded scroll shell for auth screens (native dark or web light). */
export function AuthScrollShell({
  children,
  className,
  contentClassName,
  theme = "native",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  theme?: "native" | "light";
}) {
  const isLight = theme === "light";
  return (
    <div
      className={cn(
        "h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col",
        isLight ? "bg-background text-foreground" : "bg-[#0c0a09] text-white",
        className,
      )}
    >
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4",
          "pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AuthNativeShell({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <AuthScrollShell className={className} contentClassName={contentClassName} theme="native">
      {children}
    </AuthScrollShell>
  );
}

/** AVS ERP product chrome for pre-auth screens (not demo firm name). */
export function AuthNativeBrandHeader({
  subtitle,
  showAttribution = true,
}: {
  subtitle?: string;
  showAttribution?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 mb-6 text-center">
      <img
        src={publicAsset("assets/ornexa-mark.png")}
        alt="AVS ERP"
        className="h-16 w-16 object-contain"
        width={64}
        height={64}
      />
      <p className="font-serif text-2xl tracking-[0.12em] text-white">{APP_NAME}</p>
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#B89454]">{APP_TAGLINE}</p>
      {subtitle ? <p className="text-xs text-white/75 max-w-xs leading-relaxed">{subtitle}</p> : null}
      {showAttribution ? (
        <p className="text-[9px] text-white/60 text-center max-w-xs leading-relaxed">
          {APP_PARENT_ATTRIBUTION}
        </p>
      ) : null}
    </div>
  );
}
