import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AlbumIcon, MusicNoteIcon, PlaylistIcon, UserIcon } from "@/ui/icons";
import { getArtworkUrlCandidates } from "../../datasource/youtube/artwork";
import {
  getResolvedArtworkUrl,
  rememberResolvedArtworkUrl,
} from "../../internal/artworkCache";
import { tauriFetch } from "../../datasource/youtube/tauriFetch";

const ARTWORK_RETRY_DELAYS_MS = [500, 1500];

function getRetriedArtworkUrl(url: string, retryCount: number): string {
  if (retryCount === 0 || url.startsWith("blob:")) return url;

  const hashIndex = url.indexOf("#");
  const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const separator = urlWithoutHash.includes("?") ? "&" : "?";
  return `${urlWithoutHash}${separator}artworkRetry=${retryCount}${hash}`;
}

interface TrackArtworkProps {
  artworkUrl?: string;
  className?: string;
  iconSize?: number;
  loading?: "eager" | "lazy";
  retryOnError?: boolean;
  variant?: "track" | "album" | "artist" | "playlist";
}

export function TrackArtwork({
  artworkUrl,
  className,
  iconSize = 24,
  loading = "lazy",
  retryOnError = false,
  variant = "track",
}: TrackArtworkProps) {
  /*
   * A previously resolved URL short-circuits the whole candidate walk: it is the only
   * candidate, so a remount paints from cache instead of re-requesting the ones that failed
   * last time. Falls back to the normal ladder when nothing is cached yet.
   */
  const artworkCandidates = useMemo(() => {
    if (!artworkUrl?.trim()) return [];
    const cached = getResolvedArtworkUrl(artworkUrl);
    return cached ? [cached] : getArtworkUrlCandidates(artworkUrl);
  }, [artworkUrl]);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [proxiedArtworkUrl, setProxiedArtworkUrl] = useState<string | null>(null);
  const [loadedArtworkUrl, setLoadedArtworkUrl] = useState<string | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const baseArtworkUrl = artworkCandidates[artworkIndex] ?? proxiedArtworkUrl;
  const currentArtworkUrl = baseArtworkUrl
    ? getRetriedArtworkUrl(baseArtworkUrl, retryCount)
    : undefined;
  const isArtworkLoaded = loadedArtworkUrl === currentArtworkUrl;
  const FallbackIcon =
    variant === "artist"
      ? UserIcon
      : variant === "album"
        ? MusicNoteIcon
        : variant === "playlist"
          ? PlaylistIcon
          : AlbumIcon;

  useEffect(() => {
    setArtworkIndex(0);
    setRetryCount(0);
    setProxiedArtworkUrl(null);
    setLoadedArtworkUrl(null);
  }, [artworkUrl]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setRetryCount(0);
    setLoadedArtworkUrl(null);
  }, [baseArtworkUrl]);

  useEffect(() => {
    if (!artworkUrl || artworkIndex < artworkCandidates.length || proxiedArtworkUrl) return;

    let objectUrl: string | null = null;
    let active = true;

    void tauriFetch(artworkUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Artwork request failed with HTTP ${response.status}.`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        // Handed to the cache, which now owns revoking it — see the unmount note below.
        rememberResolvedArtworkUrl(artworkUrl, objectUrl, { ownsObjectUrl: true });
        objectUrl = null;
        setProxiedArtworkUrl(getResolvedArtworkUrl(artworkUrl) ?? null);
      })
      .catch(() => {
        if (active) setProxiedArtworkUrl(null);
      });

    return () => {
      active = false;
      // Only revokes a blob the cache never took ownership of; a cached one stays alive so
      // the next mount reuses it instead of re-downloading.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artworkCandidates.length, artworkIndex, artworkUrl, proxiedArtworkUrl]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden text-muted-foreground",
        className,
      )}
    >
      <FallbackIcon
        className={cn(
          "transition-opacity duration-200",
          isArtworkLoaded ? "opacity-0" : "opacity-65",
        )}
        size={iconSize}
        aria-hidden="true"
      />
      {currentArtworkUrl && (
        <img
          /*
           * Sized inline rather than with h-full/w-full utilities: the artwork sits inside
           * aspect-ratio and 3D-transformed (TiltCard) parents where a percentage height can
           * resolve against an indefinite container. Explicit inset + 100% is unambiguous.
           */
          style={{ width: "100%", height: "100%" }}
          className={cn(
            "absolute inset-0 object-cover transition-opacity duration-200",
            isArtworkLoaded ? "opacity-100" : "opacity-0",
          )}
          src={currentArtworkUrl}
          alt=""
          loading={loading}
          onLoad={() => {
            setLoadedArtworkUrl(currentArtworkUrl);
            /*
             * Record the candidate that actually rendered, keyed by the source URL. The
             * retry suffix is stripped: it exists only to bust a failed request, and caching
             * it would make every future mount replay that cache-buster.
             */
            if (artworkUrl && baseArtworkUrl && !baseArtworkUrl.startsWith("blob:")) {
              rememberResolvedArtworkUrl(artworkUrl, baseArtworkUrl);
            }
          }}
          onError={() => {
            setLoadedArtworkUrl(null);
            if (retryOnError && retryCount < ARTWORK_RETRY_DELAYS_MS.length) {
              if (retryTimerRef.current !== null) {
                window.clearTimeout(retryTimerRef.current);
              }
              retryTimerRef.current = window.setTimeout(() => {
                retryTimerRef.current = null;
                setRetryCount((count) =>
                  count === retryCount ? count + 1 : count,
                );
              }, ARTWORK_RETRY_DELAYS_MS[retryCount]);
              return;
            }
            setRetryCount(0);
            setArtworkIndex((index) => index + 1);
          }}
        />
      )}
    </span>
  );
}
