/**
 * Shared person/worker/user profile avatar.
 * Matches tenant user-menu chip in AppShell: photo when present from R2 / Cloudflare storage,
 * otherwise primary-filled initials (first letters of name, max 2).
 */
import { useEffect, useState } from "react";
import { useAttachmentUrl } from "@/lib/attachments-store";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";
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
  personId?: string;
  person?: any;
  avatarUrl?: string | null;
  name?: string;
  className?: string;
  imgClassName?: string;
  docKey?: string;
  "data-testid"?: string;
};

export function PersonProfileAvatar({
  personId,
  person,
  avatarUrl: explicitAvatarUrl,
  name = "",
  className,
  imgClassName,
  docKey = "photo",
  "data-testid": testId,
}: Props) {
  const [broken, setBroken] = useState(false);
  const [asyncR2Url, setAsyncR2Url] = useState<string | null>(null);

  const pid = personId || person?.id || "";

  // 1. Direct hook resolution for person, worker, user, customer
  const personPhotoUrl = useAttachmentUrl("person", pid, docKey);
  const workerPhotoUrl = useAttachmentUrl("worker", pid, docKey);
  const userPhotoUrl = useAttachmentUrl("person", pid, docKey);

  // 2. Direct property candidates from person/user profile object
  const directCandidate =
    explicitAvatarUrl ||
    person?.avatar_url ||
    person?.photoUrl ||
    person?.photo_url ||
    person?.avatarUrl ||
    person?.profile_image ||
    person?.image_url ||
    person?.data?.avatar_url ||
    person?.data?.photoUrl ||
    person?.data?.photo_url ||
    personPhotoUrl ||
    workerPhotoUrl ||
    userPhotoUrl ||
    null;

  // 3. Resolve R2 storage paths if passed as storage path (e.g. firms/...)
  const storagePathCandidate =
    person?.avatarStoragePath ||
    person?.avatar_storage_path ||
    person?.storage_path ||
    person?.data?.avatarStoragePath ||
    person?.data?.avatar_storage_path ||
    null;

  useEffect(() => {
    let cancelled = false;
    if (!storagePathCandidate || directCandidate?.startsWith("http") || directCandidate?.startsWith("blob:") || directCandidate?.startsWith("data:")) {
      setAsyncR2Url(null);
      return;
    }
    const bucket = person?.bucket || "customer-documents";
    void getAttachmentSignedUrl(bucket, storagePathCandidate)
      .then((res) => {
        if (!cancelled && res) setAsyncR2Url(res);
      })
      .catch(() => {
        if (!cancelled) setAsyncR2Url(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storagePathCandidate, directCandidate, person?.bucket]);

  const finalPhotoUrl = directCandidate || asyncR2Url;
  const showPhoto = Boolean(finalPhotoUrl) && !broken;
  const initials = nameInitials(name);

  if (showPhoto && finalPhotoUrl) {
    return (
      <div className={cn("overflow-hidden bg-accent shrink-0 select-none", className)}>
        <img
          src={finalPhotoUrl}
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
