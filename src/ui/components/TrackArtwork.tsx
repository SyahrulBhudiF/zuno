import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AlbumIcon, MusicNoteIcon, PlaylistIcon, UserIcon } from "@/ui/icons";
import { getArtworkSizeBucket, getArtworkUrlCandidates } from "../../datasource/youtube/artwork";
import {
  forgetResolvedArtworkUrl,
  getResolvedArtworkUrl,
  hasArtworkFailed,
  rememberResolvedArtworkUrl,
  resolveArtworkThroughProxy,
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
  /**
   * Rendered width in CSS pixels, matching the `size-*` class on `className`.
   *
   * Sets which size variant is requested. Without it the original, full-size image is loaded:
   * correct for hero art, but a 40px row decoding a 544px cover costs ~1.2 MB of texture
   * instead of ~0.06 MB, and a list holds fifty of them.
   */
  size?: number;
  variant?: "track" | "album" | "artist" | "playlist";
}

export function TrackArtwork({
  artworkUrl,
  className,
  iconSize = 24,
  loading = "lazy",
  retryOnError = false,
  size,
  variant = "track",
}: TrackArtworkProps) {
  const sizeBucket = size == null ? null : getArtworkSizeBucket(size);
  /*
   * Resolutions are cached per source *and* per requested size.
   *
   * Keying on the source alone would let whichever component mounted first decide the size for
   * every other one — a queue row resolving at 120px would then be handed to the page header,
   * which paints it at 300px and looks visibly soft.
   */
  const cacheKey = artworkUrl && sizeBucket !== null ? `${artworkUrl}@${sizeBucket}` : artworkUrl;
  /*
   * A previously resolved URL short-circuits the whole candidate walk: it is the only
   * candidate, so a remount paints from cache instead of re-requesting the ones that failed
   * last time. Falls back to the normal ladder when nothing is cached yet.
   */
  const artworkCandidates = useMemo(() => {
    if (!artworkUrl?.trim()) return [];
    const cached = cacheKey ? getResolvedArtworkUrl(cacheKey) : undefined;
    return cached ? [cached] : getArtworkUrlCandidates(artworkUrl, sizeBucket);
  }, [artworkUrl, cacheKey, sizeBucket]);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [proxiedArtworkUrl, setProxiedArtworkUrl] = useState<string | null>(null);
  /*
   * Seeded from the cache rather than starting at null.
   *
   * A mount with a known-good URL is not "not loaded yet" — the bytes are in the webview's
   * cache or in a live blob, and treating it as unknown means one frame of fallback icon before
   * onLoad fires. That flash is what shows up when dragging a song: reordering shifts every
   * row's index, index is part of the React key, so the rows remount and every cover blinks.
   *
   * Optimistic rather than assumed: if the cached URL turns out to be dead, onError still runs
   * and the ladder continues from there.
   */
  const [loadedArtworkUrl, setLoadedArtworkUrl] = useState<string | null>(
    () => (cacheKey ? getResolvedArtworkUrl(cacheKey) ?? null : null),
  );
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
    // Same reasoning as the initial state: a cached resolution is already loaded, not unknown.
    setLoadedArtworkUrl(cacheKey ? getResolvedArtworkUrl(cacheKey) ?? null : null);
  }, [artworkUrl, cacheKey]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }
  }, []);

  /*
   * Only when the candidate actually *changes*, never on mount.
   *
   * Running this on the first render would immediately undo the cache seeding above and
   * reintroduce the fallback flash, since an effect fires after the first paint.
   */
  const previousBaseUrlRef = useRef(baseArtworkUrl);
  useEffect(() => {
    if (previousBaseUrlRef.current === baseArtworkUrl) return;
    previousBaseUrlRef.current = baseArtworkUrl;
    setRetryCount(0);
    setLoadedArtworkUrl(null);
  }, [baseArtworkUrl]);

  useEffect(() => {
    if (!artworkUrl || !cacheKey || artworkIndex < artworkCandidates.length || proxiedArtworkUrl) {
      return;
    }
    // Every candidate already failed for this source once; re-walking earns the same 404s.
    if (hasArtworkFailed(cacheKey)) return;

    let active = true;

    /*
     * Shared per source URL and size by the cache, so a screen of rows on the same album issues
     * one proxy request between them rather than one each. The blob is owned by the cache and
     * deliberately survives this unmount — that is what makes a re-scroll free.
     *
     * Fetches the head of the ladder, which is the sized variant when one was requested: the
     * proxy path should not be the one place that quietly downloads the full-size original.
     */
    const proxyUrl = getArtworkUrlCandidates(artworkUrl, sizeBucket)[0] ?? artworkUrl;
    void resolveArtworkThroughProxy(cacheKey, async () => {
      const response = await tauriFetch(proxyUrl, {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      if (!response.ok) throw new Error(`Artwork request failed with HTTP ${response.status}.`);
      return response.blob();
    }).then((objectUrl) => {
      if (active) setProxiedArtworkUrl(objectUrl);
    });

    return () => {
      active = false;
    };
  }, [artworkCandidates.length, artworkIndex, artworkUrl, cacheKey, sizeBucket, proxiedArtworkUrl]);

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
             * Record the candidate that actually rendered, keyed by source URL and size. The
             * retry suffix is stripped: it exists only to bust a failed request, and caching
             * it would make every future mount replay that cache-buster.
             */
            if (cacheKey && baseArtworkUrl && !baseArtworkUrl.startsWith("blob:")) {
              rememberResolvedArtworkUrl(cacheKey, baseArtworkUrl);
            }
          }}
          onError={() => {
            setLoadedArtworkUrl(null);
            /*
             * A cached resolution that fails is stale — the URL worked once and no longer does.
             * Dropping it rebuilds the full candidate ladder next time instead of retrying the
             * same dead URL on every mount from here on.
             */
            if (cacheKey && baseArtworkUrl === getResolvedArtworkUrl(cacheKey)) {
              forgetResolvedArtworkUrl(cacheKey);
            }
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
