import {
  parseVimeoId,
  parseYouTubeId,
  vimeoEmbedUrl,
  youtubeEmbedUrl,
  type VideoProvider,
} from "@/lib/website/video-embed";

export function VideoEmbed({
  videoUrl,
  provider,
  title,
  className,
}: {
  videoUrl: string;
  provider: VideoProvider | string | null;
  title?: string;
  className?: string;
}) {
  const p = (provider ?? "none") as VideoProvider;

  if (p === "youtube") {
    const id = parseYouTubeId(videoUrl);
    if (!id) return null;
    return (
      <div className={className ?? "aspect-video w-full overflow-hidden rounded-lg border border-border bg-black"}>
        <iframe
          src={youtubeEmbedUrl(id)}
          title={title ?? "Tutorial video"}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (p === "vimeo") {
    const id = parseVimeoId(videoUrl);
    if (!id) return null;
    return (
      <div className={className ?? "aspect-video w-full overflow-hidden rounded-lg border border-border bg-black"}>
        <iframe
          src={vimeoEmbedUrl(id)}
          title={title ?? "Tutorial video"}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (p === "embed" && videoUrl) {
    return (
      <div className={className ?? "aspect-video w-full overflow-hidden rounded-lg border border-border bg-black"}>
        <iframe src={videoUrl} title={title ?? "Tutorial video"} className="h-full w-full" allowFullScreen />
      </div>
    );
  }

  return null;
}
