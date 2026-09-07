/**
 * Shared person/worker/user profile avatar.
 * Matches tenant user-menu chip in AppShell: photo when present from R2 / Cloudflare storage,
 * otherwise primary-filled initials (first letters of name, max 2).
 */
import { useEffect, useState } from "react";
import { useAttachmentUrl } from "@/lib/attachments-store";
import { getDirectR2ObjectUrl, getSupabasePublicStorageUrl, normalizeR2Url } from "@/lib/supabase-storage";
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
  isLoading?: boolean;
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
  isLoading = false,
  "data-testid": testId,
}: Props) {
  const [attempt, setAttempt] = useState<"r2" | "supabase" | "broken">("r2");

  const pid = personId || person?.id || "";

  // 1. Direct hook resolution for person, worker, user, customer
  const personPhotoUrl = useAttachmentUrl("person", pid, docKey);
  const workerPhotoUrl = useAttachmentUrl("worker", pid, docKey);

  // 2. Storage path candidates
  const storagePathCandidate =
    person?.avatarStoragePath ||
    person?.avatar_storage_path ||
    person?.storage_path ||
    person?.data?.avatarStoragePath ||
    person?.data?.avatar_storage_path ||
    null;

  const bucket =
    person?.bucket ||
    (person?.type === "worker" || person?.role === "karigar" ? "worker-kyc" : "customer-documents");

  const r2StorageUrl = storagePathCandidate
    ? getDirectR2ObjectUrl(bucket, storagePathCandidate)
    : null;
  const supabaseStorageUrl = storagePathCandidate
    ? getSupabasePublicStorageUrl(bucket, storagePathCandidate)
    : null;

  useEffect(() => {
    setAttempt("r2");
  }, [pid, explicitAvatarUrl, storagePathCandidate]);

  // 3. Direct property candidates
  const rawCandidate =
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
    null;

  // Discard empty strings
  const validDirectCandidate =
    rawCandidate && typeof rawCandidate === "string" && rawCandidate.trim() !== ""
      ? normalizeR2Url(rawCandidate.trim())
      : null;

  // If candidate is a storage path (e.g. starts with firms/ or branches/ or platform/), resolve to R2
  const resolvedUrl =
    (validDirectCandidate && (validDirectCandidate.startsWith("http") || validDirectCandidate.startsWith("data:")))
      ? validDirectCandidate
      : (validDirectCandidate && (validDirectCandidate.startsWith("firms/") || validDirectCandidate.startsWith("platform/")))
      ? (attempt === "r2" ? getDirectR2ObjectUrl(bucket, validDirectCandidate) : getSupabasePublicStorageUrl(bucket, validDirectCandidate))
      : (attempt === "r2" ? (r2StorageUrl || validDirectCandidate) : (supabaseStorageUrl || validDirectCandidate)) ||
        null;

  const finalPhotoUrl = resolvedUrl ? normalizeR2Url(resolvedUrl) : null;

  const showPhoto = Boolean(finalPhotoUrl) && attempt !== "broken";
  const initials = nameInitials(name || person?.fullName || person?.name || "");

  if (showPhoto && finalPhotoUrl) {
    return (
      <div className={cn("overflow-hidden bg-accent shrink-0 select-none relative", className)}>
        <img
          src={finalPhotoUrl}
          alt={name || person?.fullName || "Avatar"}
          crossOrigin="anonymous"
          loading="lazy"
          onError={() => {
            if (attempt === "r2" && supabaseStorageUrl && supabaseStorageUrl !== r2StorageUrl) {
              setAttempt("supabase");
            } else {
              setAttempt("broken");
            }
          }}
          className={cn("h-full w-full object-cover", imgClassName)}
          data-testid={testId}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
            <div className="h-3.5 w-3.5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // Exact same surface as AppShell tenant chip — works in light + dark.
  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground grid place-items-center font-bold text-sm shrink-0 select-none relative",
        className,
      )}
      aria-label={name}
      data-testid={testId}
      title={name}
    >
      {isLoading ? (
        <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className="leading-none tracking-tight">{initials}</span>
      )}
    </div>
  );
}
