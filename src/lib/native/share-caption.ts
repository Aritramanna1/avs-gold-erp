/**
 * Human share captions for native Sharesheet. PDF is the attachment;
 * this text is the message body. Firm name is always last.
 */
import { useSettings } from "@/lib/settings-store";
import { formatDateShort } from "@/lib/format-date";

function firmName(): string {
  return useSettings.getState().firm?.shopName?.trim() || "AVS ERP";
}

function dashJoin(parts: Array<string | undefined | null>): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(" — ");
}

export function documentShareCaption(input: {
  docLabel: string;
  docNo?: string;
  partyName?: string;
  extra?: string;
}): string {
  const head = [input.docLabel, input.docNo].filter(Boolean).join(" ");
  const forParty = input.partyName ? `for ${input.partyName}` : undefined;
  return dashJoin([head, forParty, input.extra, firmName()]);
}

export function reportShareCaption(input: {
  title: string;
  from?: string;
  to?: string;
}): string {
  const range =
    input.from || input.to
      ? [input.from ? formatDateShort(input.from) : "", input.to ? formatDateShort(input.to) : ""]
          .filter(Boolean)
          .join(" to ")
      : undefined;
  return dashJoin([input.title, range, firmName()]);
}

export function catalogShareCaption(pieceCount: number): string {
  const n = Math.max(0, pieceCount);
  return dashJoin([`Design catalog`, `${n} piece${n === 1 ? "" : "s"}`, firmName()]);
}
