/** Parse YouTube / Vimeo URLs for public tutorial embeds. */

export type VideoProvider = "youtube" | "vimeo" | "embed" | "none";

export function parseYouTubeId(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseVimeoId(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function detectVideoProvider(url: string): VideoProvider {
  const trimmed = url.trim();
  if (!trimmed) return "none";
  if (parseYouTubeId(trimmed)) return "youtube";
  if (parseVimeoId(trimmed)) return "vimeo";
  if (/^https?:\/\//i.test(trimmed)) return "embed";
  return "none";
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

export function vimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
