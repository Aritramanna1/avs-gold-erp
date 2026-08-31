/**
 * Central URL builders — ERP generates links; public pages live on marketing/portal hosts.
 */
import { erpOrigin, marketingOrigin, portalOrigin } from "@/lib/public-origin";

function withPath(origin: string, pathname: string, search = ""): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const base = origin.replace(/\/$/, "");
  return `${base}${path}${search}`;
}

export function verifyUrl(code: string): string {
  const params = new URLSearchParams({ code });
  return withPath(marketingOrigin(), "/verify", `?${params.toString()}`);
}

export function verifyBarcodeUrl(barcode: string): string {
  const params = new URLSearchParams({ barcode });
  return withPath(marketingOrigin(), "/verify", `?${params.toString()}`);
}

export function documentShareUrl(token: string): string {
  return withPath(marketingOrigin(), `/doc/${encodeURIComponent(token)}`);
}

export function portalInviteUrl(code: string, email?: string): string {
  const params = new URLSearchParams({ code });
  if (email?.trim()) params.set("email", email.trim());
  return withPath(portalOrigin(), "/invite/accept", `?${params.toString()}`);
}

export function erpLoginUrl(): string {
  return withPath(erpOrigin(), "/login");
}

export function portalHomeUrl(portal: "customer" | "karigar" | "supplier" = "customer"): string {
  const paths = {
    customer: "/customer-portal",
    karigar: "/karigar-portal",
    supplier: "/supplier-portal",
  } as const;
  return withPath(portalOrigin(), paths[portal]);
}
