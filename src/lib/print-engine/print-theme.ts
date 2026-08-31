/**
 * Single authoritative print theme resolution for screen preview and PDF.
 */
import type { CSSProperties } from "react";
import type { Branding, FirmProfile } from "@/lib/settings-store";
import type { PrintTemplate } from "./types";

export interface PrintTheme {
  primary: string;
  accent: string;
  headerBg: string;
  footerBg: string;
  text: string;
  border: string;
  fontFamily: string;
  onPrimary: string;
  onAccent: string;
  primaryTint: string;
  accentTint: string;
}

export const DEFAULT_PRINT_THEME: PrintTheme = {
  primary: "#0F172A",
  accent: "#C8A24B",
  headerBg: "#0F172A",
  footerBg: "#F8FAFC",
  text: "#1E293B",
  border: "#CBD5E1",
  fontFamily: "Inter, system-ui, sans-serif",
  onPrimary: "#F8FAFC",
  onAccent: "#0F172A",
  primaryTint: "#F1F5F9",
  accentTint: "#FFFBEB",
};

function normalizeHex(color: string | undefined, fallback: string): string {
  if (!color || !/^#[0-9A-Fa-f]{3,8}$/.test(color.trim())) return fallback;
  return color.trim();
}

export function resolvePrintTheme(
  branding: Branding,
  template?: Pick<PrintTemplate, "primaryColor" | "accentColor" | "fontFamily"> | null,
): PrintTheme {
  const base = { ...DEFAULT_PRINT_THEME };
  base.primary = normalizeHex(branding.primaryColor, base.primary);
  base.accent = normalizeHex(branding.accentColor ?? branding.goldAccent, base.accent);
  base.headerBg = normalizeHex(branding.headerColor, branding.primaryColor || base.headerBg);
  base.footerBg = normalizeHex(branding.footerColor, base.footerBg);
  base.text = normalizeHex(branding.textColor, base.text);
  base.border = normalizeHex(branding.borderColor, base.border);
  if (branding.fontFamily) base.fontFamily = branding.fontFamily;
  if (template?.primaryColor) {
    base.primary = normalizeHex(template.primaryColor, base.primary);
    base.headerBg = normalizeHex(template.primaryColor, base.headerBg);
  }
  if (template?.accentColor) base.accent = normalizeHex(template.accentColor, base.accent);
  if (template?.fontFamily) base.fontFamily = template.fontFamily;
  return base;
}

export function printThemeStyle(theme: PrintTheme): CSSProperties {
  return {
    ["--print-primary" as string]: theme.primary,
    ["--print-accent" as string]: theme.accent,
    ["--print-header-bg" as string]: theme.headerBg,
    ["--print-footer-bg" as string]: theme.footerBg,
    ["--print-text" as string]: theme.text,
    ["--print-border" as string]: theme.border,
    ["--print-on-primary" as string]: theme.onPrimary,
    ["--print-on-accent" as string]: theme.onAccent,
    ["--print-primary-tint" as string]: theme.primaryTint,
    ["--print-accent-tint" as string]: theme.accentTint,
    fontFamily: theme.fontFamily,
  };
}

export type BrandedFirmProfile = FirmProfile & {
  themeColors: {
    primaryColor: string;
    goldAccent: string;
    headerColor: string;
    footerColor: string;
    textColor: string;
    borderColor: string;
    fontFamily: string;
  };
};

export function resolveBrandedFirm(
  firm: FirmProfile,
  branding: Branding,
  template?: Pick<PrintTemplate, "primaryColor" | "accentColor" | "fontFamily"> | null,
): BrandedFirmProfile {
  const theme = resolvePrintTheme(branding, template);
  return {
    ...firm,
    shopName: branding.printHeader || firm.shopName || branding.applicationName,
    tagline: firm.tagline || branding.tagline,
    email: firm.email || branding.supportEmail,
    phone: firm.phone || branding.supportPhone,
    website: firm.website || branding.website,
    themeColors: {
      primaryColor: theme.primary,
      goldAccent: theme.accent,
      headerColor: theme.headerBg,
      footerColor: theme.footerBg,
      textColor: theme.text,
      borderColor: theme.border,
      fontFamily: theme.fontFamily,
    },
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h.slice(0, 6)
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [15, 23, 42];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function firmDisplayName(firm: FirmProfile, branding: Branding): string {
  return branding.printHeader || firm.shopName || firm.brandName || branding.applicationName || "AVS ERP";
}
