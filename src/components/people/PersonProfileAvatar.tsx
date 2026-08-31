/**
 * Shared person/worker profile avatar.
 * Matches tenant user-menu chip in AppShell: photo when present,
 * otherwise primary-filled initials (first letters of name, max 2).
 */
import { useState } from "react";
import { useAttachmentUrl } from "@/lib/attachments-store";
import { cn } from "@/lib/utils";

/** Same initials rule as the tenant profile chip in AppShell. */
export function nameInitials(displayName: string): string {
  return (
    displayName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

type Props = {
  personId: string;
  name: string;
  className?: string;
  imgClassName?: string;
  docKey?: string;
  "data-testid"?: string;
};

export function PersonProfileAvatar({
  personId,
  name,
  className,
  imgClassName,
  docKey = "photo",
  "data-testid": testId,
}: Props) {
  const [broken, setBroken] = useState(false);
  const photoUrl = useAttachmentUrl("person", personId, docKey);
  const showPhoto = Boolean(photoUrl) && !broken;
  const initials = nameInitials(name);

  if (showPhoto) {
    return (
      <div className={cn("overflow-hidden bg-accent shrink-0", className)}>
        <img
          src={photoUrl!}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className={cn("h-full w-full object-cover", imgClassName)}
          data-testid={testId}
        />
      </div>
    );
  }

  // Exact same surface as AppShell tenant chip — works in light + dark.
  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground grid place-items-center font-bold text-sm shrink-0 select-none",
        className,
      )}
      aria-label={name}
      data-testid={testId}
      title={name}
    >
      <span className="leading-none tracking-tight">{initials}</span>
    </div>
  );
}
