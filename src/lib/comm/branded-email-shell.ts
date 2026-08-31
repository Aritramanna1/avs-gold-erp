/**
 * Single AVS + firm branded HTML shell for every ERP outbound email.
 * Callers pass inner body HTML only — logo, shop name, contact, and AVS footer
 * are injected from firm settings automatically.
 * Logo is never omitted: firm logo → branding logo → AVS ERP platform PNG.
 */
import { useSettings } from "@/lib/settings-store";
import {
  PLATFORM_EMAIL_BRAND,
  resolvePlatformEmailLogoUrl,
} from "./default-email-brand";

export interface BrandedEmailShellOptions {
  title: string;
  innerHtml: string;
  firmName?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  tagline?: string;
  website?: string;
  purpose?: "promotional" | "transactional";
  unsubscribeUrl?: string | null;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve firm branding vars from settings (source of truth for ERP mail chrome). */
export function resolveEmailBrandVars(): {
  firmName: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  tagline: string;
  website: string;
  primaryColor: string;
  goldAccent: string;
  productFooter: string;
} {
  const s = useSettings.getState() as unknown as {
    firm: {
      shopName?: string;
      phone?: string;
      email?: string;
      address?: string;
      tagline?: string;
      website?: string;
      logoUrl?: string;
    };
    branding?: Record<string, string>;
    developer?: Record<string, string | boolean>;
  };
  const firm = s.firm;
  const branding = s.branding ?? {};
  const developer = s.developer ?? {};
  const firmName =
    firm.shopName ||
    branding.printHeader ||
    branding.companyName ||
    branding.applicationName ||
    "Your Jewellery Firm";
  const product =
    (typeof developer.avsName === "string" && developer.avsName) ||
    branding.applicationName ||
    PLATFORM_EMAIL_BRAND.productLine;
  return {
    firmName,
    logoUrl: resolvePlatformEmailLogoUrl({
      logoUrl: firm.logoUrl || branding.logoUrl || "",
    }),
    phone: firm.phone || branding.supportPhone || "",
    email: firm.email || branding.supportEmail || "",
    address: firm.address || "",
    tagline: firm.tagline || branding.tagline || "",
    website: firm.website || branding.website || "",
    primaryColor: branding.primaryColor || PLATFORM_EMAIL_BRAND.primaryColor,
    goldAccent: branding.goldAccent || PLATFORM_EMAIL_BRAND.goldAccent,
    productFooter: `Powered by ${product}`,
  };
}

/** Wrap arbitrary inner HTML in the unified firm + AVS email chrome. */
export function wrapBrandedEmailHtml(opts: BrandedEmailShellOptions): string {
  const brand = resolveEmailBrandVars();
  const firmName = opts.firmName || brand.firmName;
  const logoUrl = resolvePlatformEmailLogoUrl({
    logoUrl: opts.logoUrl || brand.logoUrl,
  });
  const phone = opts.phone ?? brand.phone;
  const email = opts.email ?? brand.email;
  const address = opts.address ?? brand.address;
  const tagline = opts.tagline ?? brand.tagline;
  const website = opts.website ?? brand.website;
  const primary = brand.primaryColor;
  const gold = brand.goldAccent;
  const title = esc(opts.title);
  const contactBits = [phone && `Phone: ${esc(phone)}`, email && `Email: ${esc(email)}`]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;color:#1E293B;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
    <div style="background:${esc(primary)};padding:28px 24px;text-align:center;border-bottom:4px solid ${esc(gold)};">
      <img src="${esc(logoUrl)}" alt="${esc(firmName)}" width="180" style="display:block;margin:0 auto 10px;max-height:64px;max-width:180px;object-fit:contain;border:0;" />
      <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${esc(firmName)}</div>
      ${
        tagline
          ? `<div style="color:#94A3B8;font-size:12px;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">${esc(tagline)}</div>`
          : ""
      }
    </div>
    <div style="padding:28px 24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 8px;font-size:18px;color:${esc(primary)};">${title}</h2>
        <div style="height:3px;width:40px;margin:0 auto;background:${esc(gold)};border-radius:2px;"></div>
      </div>
      ${opts.innerHtml}
    </div>
    <div style="background:#F1F5F9;padding:20px 24px;text-align:center;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;line-height:1.6;">
      <div style="font-weight:600;color:#334155;">${esc(firmName)}</div>
      ${address ? `<div>${esc(address)}</div>` : ""}
      ${contactBits ? `<div>${contactBits}</div>` : ""}
      ${
        website
          ? `<div><a href="${esc(website)}" style="color:#64748B;">${esc(website)}</a></div>`
          : ""
      }
      <div style="margin-top:12px;font-style:italic;">${esc(brand.productFooter)}</div>
      <div style="margin-top:10px;font-size:10px;color:#64748B;line-height:1.5;">
        This message was sent by ${esc(firmName)} using AVS ERP / AVS. Arivahly Venture Sphere (AVS)
        is not responsible for activities or content sent by the firm.
      </div>
      ${
        opts.purpose === "promotional" && opts.unsubscribeUrl
          ? `<div style="margin-top:10px;"><a href="${esc(opts.unsubscribeUrl)}" style="color:#64748B;text-decoration:underline;">Unsubscribe from promotional emails</a></div>`
          : ""
      }
    </div>
  </div>
</body>
</html>`;
}
