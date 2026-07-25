import { CloseIcon, RefreshIcon } from "@/ui/icons";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lyrics } from "../../datasource/types";
import { logInternalWarn } from "../../internal/logging";
import { playerController, usePlayerState } from "../../player/playerStore";
import { ArtistLinks } from "../components/ArtistLinks";

const AUTO_SCROLL_RESUME_MS = 4500;

interface LyricsViewProps {
  onClose: () => void;
}

export function LyricsView({ onClose }: LyricsViewProps) {
  const playerState = usePlayerState();
  const track = playerState.currentTrack;
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [manualScrollUntil, setManualScrollUntil] = useState(0);
  const autoScrollTimerRef = useRef<number | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    setLyrics(null);
    setFailed(false);
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
  }, [track?.id]);

  useEffect(() => {
    let frameId = 0;
    const update = () => {
      setCurrentTime(playerController.getCurrentTime());
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const timedLines = lyrics?.lines ?? [];

  const activeIndex = useMemo(() => {
    if (!timedLines.length) return -1;
    if (timedLines.some((line) => line.startTimeSec === undefined)) return -1;
    let active = 0;
    for (let index = 0; index < timedLines.length; index += 1) {
      const start = timedLines[index].startTimeSec;
      if (start === undefined || currentTime < start) break;
      active = index;
    }
    return active;
  }, [currentTime, timedLines]);

  useEffect(() => {
    if (activeIndex < 0 || performance.now() < manualScrollUntil) return;
    lineRefs.current[activeIndex]?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [activeIndex, manualScrollUntil]);

  const handleManualScroll = () => {
    if (activeIndex < 0) return;
    const resumeAt = performance.now() + AUTO_SCROLL_RESUME_MS;
    setManualScrollUntil(resumeAt);
    if (autoScrollTimerRef.current !== null) {
      window.clearTimeout(autoScrollTimerRef.current);
    }
    autoScrollTimerRef.current = window.setTimeout(() => {
      setManualScrollUntil(0);
      autoScrollTimerRef.current = null;
    }, AUTO_SCROLL_RESUME_MS);
  };

  const handleResync = () => {
    if (autoScrollTimerRef.current !== null) {
      window.clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
    setManualScrollUntil(0);
    lineRefs.current[activeIndex]?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  };

  useEffect(() => () => {
    if (autoScrollTimerRef.current !== null) {
      window.clearTimeout(autoScrollTimerRef.current);
    }
  }, []);

  const handleLineClick = (index: number) => {
    const target = timedLines[index]?.startTimeSec;
    if (target === undefined) return;
    setManualScrollUntil(0);
    void playerController.seekTo(target);
  };

  return (
    <section className="flex h-full w-[min(46rem,92vw)] flex-col" aria-label="Lyrics">
      <div className="absolute inset-0 z-40 flex justify-center bg-background/80 backdrop-blur" aria-hidden="true">
        {track?.artworkUrl && <img src={track.artworkUrl} alt="" />}
      </div>
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Lyrics</span>
        <h1>{track?.title ?? "Nothing playing"}</h1>
        {track && (
          <p>
            <ArtistLinks artists={track.artists} fallback={track.artist} />
          </p>
        )}
      </header>
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onClose}
        aria-label="Close lyrics"
        title="Close lyrics"
      >
        <CloseIcon size={20} />
      </button>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 [scrollbar-width:none]"
        onWheel={handleManualScroll}
        onPointerDown={handleManualScroll}
        onTouchMove={handleManualScroll}
      >
        <div className="flex flex-col gap-3">
          {isLoading && <p className="px-2 py-10 text-center text-sm text-muted-foreground">Loading lyrics...</p>}
          {!isLoading && (failed || !lyrics) && (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">Synchronized lyrics are not available for this song.</p>
          )}
          {!isLoading && timedLines.map((line, index) => (
            <button
              key={`${index}:${line.text}`}
              ref={(element) => {
                lineRefs.current[index] = element;
              }}
              type="button"
              className={cn("text-lg font-medium text-muted-foreground/60 transition-colors duration-200", index === activeIndex && "text-foreground")}
              onClick={() => handleLineClick(index)}
              disabled={line.startTimeSec === undefined}
            >
              {line.text}
            </button>
          ))}
        </div>
      </div>
      {manualScrollUntil > 0 && activeIndex >= 0 && (
        <button
          type="button"
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={handleResync}
          aria-label="Resync lyrics to current playback position"
        >
          <RefreshIcon size={16} aria-hidden="true" />
          <span>Resync</span>
        </button>
      )}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {lyrics?.sourceLabel && <span>Lyrics from {lyrics.sourceLabel}</span>}
      </div>
    </section>
  );
}
