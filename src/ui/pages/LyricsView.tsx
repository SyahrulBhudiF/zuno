import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CloseIcon, LyricsIcon, RefreshIcon } from "@/ui/icons";
import type { Lyrics } from "../../datasource/types";
import { logInternalWarn } from "../../internal/logging";
import { playerController, usePlayerState } from "../../player/playerStore";
import { ArtistLinks } from "../components/ArtistLinks";
import { TrackArtwork } from "../components/TrackArtwork";
import { setAmbientArtwork } from "../stores/ambientArtworkStore";
import { findActiveLineIndex, isSyncedLyrics } from "./lyricsTiming";

/** How long a manual scroll keeps the auto-follow parked. */
const AUTO_SCROLL_RESUME_MS = 4500;

/**
 * Opacity by distance from the active line, dimmest step reused past the end.
 *
 * A ramp rather than a binary lit/unlit: it gives the column a focal point you can read
 * ahead and behind, which is the whole reason to show more than one line at a time.
 */
const DISTANCE_OPACITY = ["opacity-100", "opacity-60", "opacity-40", "opacity-25"];

interface LyricsViewProps {
  onClose: () => void;
}

export function LyricsView({ onClose }: LyricsViewProps) {
  const playerState = usePlayerState();
  const track = playerState.currentTrack;
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFollowPaused, setIsFollowPaused] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLElement | null>>([]);
  const resumeTimerRef = useRef<number | null>(null);

  const lines = lyrics?.lines ?? [];
  const isSynced = isSyncedLyrics(lyrics);

  /* Read inside the animation frame below, which must not restart when the array identity
     changes — a new array every render would tear the loop down 60 times a second. */
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Same wash Layout paints for album and playlist pages, so lyrics inherit the cover's colour.
  useEffect(() => {
    setAmbientArtwork(track?.artworkUrl ?? null);
    return () => setAmbientArtwork(null);
  }, [track?.artworkUrl]);

  useEffect(() => {
    let cancelled = false;
    setLyrics(null);
    setFailed(false);
    setActiveIndex(-1);
    lineRefs.current = [];
    if (!track) return;

    setIsLoading(true);
    void playerController.getLyrics(track)
      .then((result) => {
        if (!cancelled) setLyrics(result);
      })
      .catch((error) => {
        logInternalWarn("LyricsView load failed", {
          trackId: track.id,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [track?.id, reloadToken]);

  /*
   * Own the scroll maths instead of scrollIntoView.
   *
   * This scroller is nested inside Layout's page scroll root; scrollIntoView walks up the
   * ancestor chain and moves that one too, which drags the whole page under the header.
   */
  const scrollToLine = useCallback((index: number, behavior: ScrollBehavior) => {
    const scroller = scrollerRef.current;
    const line = lineRefs.current[index];
    if (!scroller || !line) return;
    const top = line.offsetTop - scroller.clientHeight / 2 + line.offsetHeight / 2;
    scroller.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  useEffect(() => {
    if (!isSynced) {
      setActiveIndex(-1);
      return;
    }

    let frame = 0;
    let current = -1;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const next = findActiveLineIndex(linesRef.current, playerController.getCurrentTime());
      /* Committing every frame would re-render the whole column sixty times a second for a
         value that changes a few times a minute. Only the flip is worth a render. */
      if (next === current) return;
      current = next;
      setActiveIndex(next);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isSynced, lyrics]);

  // A fresh song starts at the top, whether or not it turned out to be synced.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [lyrics]);

  useEffect(() => {
    if (activeIndex < 0 || isFollowPaused) return;
    scrollToLine(activeIndex, "smooth");
  }, [activeIndex, isFollowPaused, scrollToLine]);

  useEffect(() => () => {
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const pauseFollow = () => {
    if (!isSynced || activeIndex < 0) return;
    setIsFollowPaused(true);
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null;
      setIsFollowPaused(false);
    }, AUTO_SCROLL_RESUME_MS);
  };

  const resumeFollow = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    setIsFollowPaused(false);
    scrollToLine(activeIndex, "smooth");
  };

  const handleLineClick = (index: number) => {
    const target = lines[index]?.startTimeSec;
    if (target === undefined) return;
    resumeFollow();
    void playerController.seekTo(target);
  };

  const hasLines = lines.length > 0;

  return (
    <section className="relative flex h-full min-h-0 w-full flex-col" aria-label="Lyrics">
      <header className="flex shrink-0 items-center gap-4 px-6 pb-4 pt-5">
        <TrackArtwork
          artworkUrl={track?.artworkUrl}
          size={64}
          className="size-16 rounded-xl shadow-lg shadow-black/20"
          iconSize={22}
          loading="eager"
        />
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <LyricsIcon size={13} aria-hidden="true" />
            Lyrics
          </span>
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
            {track?.title ?? "Nothing playing"}
          </h1>
          {track && (
            <p className="truncate text-sm text-muted-foreground">
              <ArtistLinks artists={track.artists} fallback={track.artist} />
            </p>
          )}
        </div>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
          aria-label="Close lyrics"
          title="Close lyrics (Esc)"
        >
          <CloseIcon size={20} />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          /* `relative` makes this the offsetParent the scroll maths above measures against. */
          className="relative h-full overflow-y-auto overscroll-contain px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onWheel={pauseFollow}
          onPointerDown={pauseFollow}
          onTouchMove={pauseFollow}
        >
          <div
            className={cn(
              "mx-auto max-w-3xl",
              // Half a viewport of air top and bottom so the first and last line can still
              // reach the centre, where the highlight lives.
              isSynced ? "py-[42vh]" : "pb-16 pt-2",
            )}
          >
            {isLoading && <LyricsSkeleton />}

            {!isLoading && !track && (
              <LyricsMessage text="Play something to see its lyrics." />
            )}

            {!isLoading && track && !hasLines && (
              <LyricsMessage
                text={failed ? "Lyrics could not be loaded." : "No lyrics found for this song."}
                onRetry={() => setReloadToken((token) => token + 1)}
              />
            )}

            {!isLoading && hasLines && (
              <div className={cn("flex flex-col", isSynced ? "gap-6" : "gap-3")}>
                {lines.map((line, index) => {
                  const distance = activeIndex < 0 ? 1 : Math.abs(index - activeIndex);
                  const dim = DISTANCE_OPACITY[Math.min(distance, DISTANCE_OPACITY.length - 1)];
                  const isActive = isSynced && index === activeIndex;
                  const attach = (element: HTMLElement | null) => {
                    lineRefs.current[index] = element;
                  };

                  // An empty LRC line is a real instrumental beat, not junk — keep its slot so
                  // the timing stays honest, but do not offer it as a seek target.
                  if (!line.text.trim()) {
                    return (
                      <div
                        key={`${index}:blank`}
                        ref={attach}
                        aria-hidden="true"
                        className="h-2"
                      />
                    );
                  }

                  if (!isSynced) {
                    return (
                      <p
                        key={`${index}:${line.text}`}
                        ref={attach}
                        className="text-lg leading-relaxed text-foreground/75"
                      >
                        {line.text}
                      </p>
                    );
                  }

                  return (
                    <button
                      key={`${index}:${line.text}`}
                      ref={attach}
                      type="button"
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "origin-left rounded-lg text-left text-2xl font-semibold leading-snug tracking-tight",
                        "transition-[opacity,color,transform] duration-500 ease-out sm:text-3xl",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive ? "text-foreground" : "text-foreground/90 hover:opacity-90",
                        dim,
                      )}
                      onClick={() => handleLineClick(index)}
                    >
                      {line.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Fades the column into the chrome at both ends instead of cutting lines in half. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />

        {isFollowPaused && activeIndex >= 0 && (
          <button
            type="button"
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg ring-1 ring-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={resumeFollow}
            aria-label="Resync lyrics to current playback position"
          >
            <RefreshIcon size={15} aria-hidden="true" />
            Back to current line
          </button>
        )}
      </div>

      <footer className="flex h-9 shrink-0 items-center justify-between gap-3 px-6 pb-2 text-xs text-muted-foreground">
        <span className="truncate">
          {lyrics?.sourceLabel ? `Source: ${lyrics.sourceLabel}` : ""}
        </span>
        {hasLines && (
          <span className="shrink-0 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
            {isSynced ? "Synced" : "Unsynced"}
          </span>
        )}
      </footer>
    </section>
  );
}

/* Staggered bars rather than a spinner: it previews the shape of what is arriving, so the
   swap to real lines reads as content landing instead of a screen change. */
function LyricsSkeleton() {
  const widths = [72, 58, 84, 46, 66, 78, 52];
  return (
    <div className="flex flex-col gap-6 pt-10">
      {widths.map((width, index) => (
        <div
          key={width}
          className="h-7 animate-pulse rounded-lg bg-foreground/10"
          style={{ width: `${width}%`, animationDelay: `${index * 90}ms` }}
        />
      ))}
    </div>
  );
}

function LyricsMessage({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-2 py-24 text-center">
      <LyricsIcon size={28} className="text-muted-foreground/50" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {onRetry && (
        <button
          type="button"
          className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onRetry}
        >
          <RefreshIcon size={15} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
