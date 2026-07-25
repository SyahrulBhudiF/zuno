import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PauseActiveIcon, PlayActiveIcon, ShuffleActiveIcon } from "@/ui/icons";
import { SpinnerSteps } from "@/components/motion/loader";
import { TrackArtwork } from "./TrackArtwork";
import { setAmbientArtwork } from "../stores/ambientArtworkStore";

/** "24 songs · 1 hr 32 min" — omits the duration when the source did not supply one. */
export function formatCollectionMeta(
  trackCount: number,
  totalDurationSec: number,
  hasMore = false,
): string {
  const countLabel = `${trackCount}${hasMore ? "+" : ""} ${trackCount === 1 ? "song" : "songs"}`;
  if (totalDurationSec <= 0) return countLabel;

  const totalMinutes = Math.round(totalDurationSec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationLabel = hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
  return `${countLabel} · ${durationLabel}`;
}

interface MediaHeaderProps {
  /** Small uppercase kicker: PLAYLIST, ALBUM, ARTIST. */
  eyebrow: string;
  /** ReactNode so a page can make the title interactive — the artist page's copies its URL. */
  title: ReactNode;
  /** Owner, artist links — the line directly under the title. */
  subtitle?: ReactNode;
  /** Counts and durations; rendered quieter than the subtitle. */
  meta?: ReactNode;
  artworkUrl?: string;
  artworkVariant?: "track" | "album" | "artist" | "playlist";
  /** Replaces the artwork entirely — Liked Songs uses its own glyph. */
  artworkSlot?: ReactNode;
  /** Artists read as people, so their image is circular. */
  circularArtwork?: boolean;
  /** Called for both play and pause — the page decides which, from `isPlaying`. */
  onPlay?: () => void;
  /** True while a track from *this* collection is playing, so the button reads "Pause". */
  isPlaying?: boolean;
  /** This collection is starting playback; the button holds its width and shows a spinner. */
  isLoading?: boolean;
  onShuffle?: () => void;
  actionsDisabled?: boolean;
  /** Extra controls beside play/shuffle, e.g. Subscribe. */
  actions?: ReactNode;
}

/**
 * Shared hero for the playlist, album and artist pages.
 *
 * All three previously hand-rolled the same artwork + title + shuffle arrangement, which is
 * how they ended up subtly different sizes and how only some of them offered a given action.
 *
 * Two deliberate design choices:
 *
 * - **Play is the primary action, shuffle is secondary.** These pages only offered Shuffle,
 *   so the obvious intent — play this, in order — had no button at all.
 * - **The artwork tints its own header.** The image is reused, blown up and blurred behind
 *   the text, so each collection carries its own colour without a palette extraction step or
 *   a second network request. Kept faint so it never competes with the title.
 */
export function MediaHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  artworkUrl,
  artworkVariant = "playlist",
  artworkSlot,
  circularArtwork = false,
  onPlay,
  isPlaying = false,
  isLoading = false,
  onShuffle,
  actionsDisabled = false,
  actions,
}: MediaHeaderProps) {
  /*
   * The wash is painted by Layout, which sits above the scroll container this header lives
   * in — it has to start behind the search bar, and anything drawn here would be clipped at
   * the scroller's top edge. Cleared on unmount so the tint leaves with the page.
   */
  useEffect(() => {
    setAmbientArtwork(artworkUrl ?? null);
    return () => setAmbientArtwork(null);
  }, [artworkUrl]);

  return (
    <header className="relative flex flex-wrap items-end gap-6 px-1 pb-6 pt-2">
      {artworkSlot ?? (
        <TrackArtwork
          className={cn(
            "size-44 shrink-0 shadow-2xl ring-1 ring-white/10",
            circularArtwork ? "rounded-full" : "rounded-2xl",
          )}
          artworkUrl={artworkUrl}
          iconSize={72}
          loading="eager"
          variant={artworkVariant}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </span>
        {/* Long album titles otherwise push the actions off the row entirely. */}
        <h1 className="line-clamp-2 text-4xl font-bold tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        {subtitle ? <div className="text-sm text-foreground/80">{subtitle}</div> : null}
        {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {onPlay ? (
            /*
             * Reflects this collection's own state, not the player's: it only becomes a
             * Pause control while the track being played belongs here. Playing something
             * else leaves this reading "Play", which is what the button would then do.
             */
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={onPlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex min-w-[7.5rem] items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isLoading ? (
                <>
                  <SpinnerSteps size={18} color="currentColor" />
                  Loading
                </>
              ) : isPlaying ? (
                <>
                  <PauseActiveIcon size={18} aria-hidden="true" />
                  Pause
                </>
              ) : (
                <>
                  <PlayActiveIcon size={18} aria-hidden="true" />
                  Play
                </>
              )}
            </button>
          ) : null}

          {onShuffle ? (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={onShuffle}
              className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ShuffleActiveIcon size={18} aria-hidden="true" />
              Shuffle
            </button>
          ) : null}

          {actions}
        </div>
      </div>
    </header>
  );
}
