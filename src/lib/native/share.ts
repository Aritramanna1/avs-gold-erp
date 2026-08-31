/**
 * Native share sheet — Capacitor Share on device, Web Share API fallback.
 * Opening the sheet is not delivery. Callers must log share_initiated, not SENT.
 */
import { isNativeApp } from "@/lib/native/platform";

export type ShareOutcome = {
  /** Share sheet opened or clipboard fallback used. Not proof of delivery. */
  initiated: boolean;
  /** Alias of initiated for existing callers. Do not treat as SENT. */
  shared: boolean;
  /** Android package / iOS activity if the OS reports one. Not proof of send. */
  activityType?: string;
};

/** True when OS / Web Share (or native Capacitor Share) can open a sheet. */
export function nativeShareAvailable(): boolean {
  if (isNativeApp()) return true;
  if (typeof navigator === "undefined") return false;
  return typeof navigator.share === "function";
}

function outcome(initiated: boolean, activityType?: string): ShareOutcome {
  return { initiated, shared: initiated, activityType };
}

export async function shareContent(opts: {
  title?: string;
  text?: string;
  url?: string;
  /** file:// or content:// URIs for Capacitor Share.files */
  fileUris?: string[];
  files?: File[];
}): Promise<ShareOutcome> {
  if (isNativeApp()) {
    const { Share } = await import(/* @vite-ignore */ "@capacitor/share");
    // Files only — never dual url + file:// (FileUriExposedException).
    const result = await Share.share({
      title: opts.title,
      text: opts.text,
      ...(opts.fileUris?.length ? { files: opts.fileUris } : opts.url ? { url: opts.url } : {}),
      dialogTitle: opts.title ?? "Share",
    });
    return outcome(true, (result as { activityType?: string } | void)?.activityType);
  }

  if (opts.files?.length && navigator.canShare?.({ files: opts.files })) {
    await navigator.share({ title: opts.title, text: opts.text, files: opts.files });
    return outcome(true);
  }

  if (navigator.share) {
    await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
    return outcome(true);
  }

  if (opts.url) {
    await navigator.clipboard.writeText(opts.url);
    return outcome(true);
  }

  if (opts.text) {
    await navigator.clipboard.writeText(opts.text);
    return outcome(true);
  }

  return outcome(false);
}
