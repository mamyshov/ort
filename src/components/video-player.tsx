import "server-only";
import { createHash } from "node:crypto";

type Props = {
  provider: "bunny" | "youtube" | "vimeo" | null;
  videoRef: string | null;
  title: string;
};

/**
 * Источник видео сменный: урок хранит провайдера и идентификатор.
 * Для Bunny ссылка подписывается временным токеном, поэтому её нельзя переслать надолго.
 */
export function videoUrl({ provider, videoRef }: Pick<Props, "provider" | "videoRef">): string | null {
  if (!provider || !videoRef) return null;
  const ref = encodeURIComponent(videoRef);
  switch (provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${ref}?rel=0&modestbranding=1`;
    case "vimeo":
      return `https://player.vimeo.com/video/${ref}`;
    case "bunny": {
      const library = process.env.BUNNY_STREAM_LIBRARY_ID;
      if (!library) return null;
      const base = `https://iframe.mediadelivery.net/embed/${library}/${ref}`;
      const key = process.env.BUNNY_STREAM_TOKEN_KEY;
      if (!key) return base;
      const expires = Math.floor(Date.now() / 1000) + 4 * 3600;
      const token = createHash("sha256").update(key + videoRef + expires).digest("hex");
      return `${base}?token=${token}&expires=${expires}&preload=false`;
    }
  }
}

export function VideoPlayer({ provider, videoRef, title, fallback }: Props & { fallback: string }) {
  const src = videoUrl({ provider, videoRef });
  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-zinc-100 text-sm text-zinc-500">
        {fallback}
      </div>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-3xl bg-black shadow-card">
      <iframe
        src={src}
        title={title}
        className="h-full w-full"
        allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
