import {
  memo,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { PlayActiveIcon } from "@/ui/icons";
import type { Track } from "../../datasource/types";
import { ArtistLinks } from "./ArtistLinks";
import { TrackArtwork } from "./TrackArtwork";

/**
 * Anything else a caller needs on the underlying button — the playlist page attaches
 * pointer handlers and a data attribute here for drag-reorder. `onClick` and `onContextMenu`
 * are owned by this component, so they are excluded to keep one source of truth.
 */
type PassthroughButtonProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "onClick" | "onContextMenu" | "children" | "className" | "type"
>;

interface TrackRowProps extends PassthroughButtonProps {
  track: Track;
  /** Zero-based; rendered as the 1-based position. */
  index: number;
  /** This is the track the player is on, whether or not it is currently advancing. */
  isCurrent: boolean;
  /** Current *and* actually playing — drives the level meter over the static glyph. */
  isPlaying: boolean;
  onSelect: () => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  /** Album pages repeat one cover on every row, so they opt out. */
  showArtwork?: boolean;
  /** Hides the artist whose page we are already on. */
  suppressArtistId?: string;
  /** Right-aligned extras — play counts, durations, remove buttons. */
  trailing?: ReactNode;
  className?: string;
  /** Rendered inside the row: drag indicators and the like. */
  children?: ReactNode;
}

/**
 * One track in a list, shared by the playlist, album and artist pages.
 *
 * Those three had drifted into three different rows — only one showed artwork, only one
 * showed what was playing, and each styled its title differently. Sharing them means the
 * now-playing treatment is defined once and cannot fall out of sync again.
 *
 * Memoised on purpose. The lists subscribe to player state so they can mark the current
 * track, which re-renders the list on every track change; without this, a 500-row playlist
 * would rebuild every row to repaint two of them. Every prop is either a primitive or a
 * stable reference (track objects come straight from the data source), so the comparison is
 * cheap and actually holds.
 */
export const TrackRow = memo(function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  onSelect,
  onContextMenu,
  showArtwork = true,
  suppressArtistId,
  trailing,
  className,
  children,
  ...buttonProps
}: TrackRowProps) {
  return (
    <button
      {...buttonProps}
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "group/row relative flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left",
        "transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-inset focus-visible:ring-ring",
        isCurrent && "bg-primary/5",
        className,
      )}
    >
      {children}

      {/* The position number is only useful until you have decided to act on the row, so it
          gives way to a play glyph on hover — and to a level meter once this row is the one
          playing. All three share the slot, so the row never reflows between states. */}
      <span className="relative w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        <span
          className={cn(
            "transition-opacity",
            isCurrent ? "opacity-0" : "group-hover/row:opacity-0",
          )}
        >
          {index + 1}
        </span>

        {!isCurrent && (
          <PlayActiveIcon
            size={14}
            className="absolute inset-0 m-auto opacity-0 transition-opacity group-hover/row:opacity-100"
            aria-hidden="true"
          />
        )}

        {isCurrent && (
          <span className="absolute inset-0 flex items-center justify-end gap-[2px]" aria-hidden="true">
            {isPlaying ? (
              [0, 1, 2].map((bar) => (
                <span
                  key={bar}
                  className="h-3 w-[2px] origin-bottom rounded-full bg-primary motion-safe:animate-[rowEq_900ms_ease-in-out_infinite]"
                  style={{ animationDelay: `${bar * 140}ms` }}
                />
              ))
            ) : (
              <PlayActiveIcon size={14} className="text-primary" />
            )}
          </span>
        )}
      </span>

      {showArtwork ? (
        <TrackArtwork
          className="size-10 shrink-0 rounded-md"
          artworkUrl={track.artworkUrl}
          iconSize={18}
        />
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm font-medium",
            isCurrent ? "text-primary" : "text-foreground",
          )}
        >
          {track.title}
        </span>
        <ArtistLinks
          className="truncate text-xs text-muted-foreground"
          artists={track.artists}
          fallback={track.artist}
          suppressArtistId={suppressArtistId}
        />
      </span>

      {trailing}

      {/* Announced to screen readers only; the meter above is decorative. */}
      {isCurrent ? (
        <span className="sr-only">{isPlaying ? "Now playing" : "Paused"}</span>
      ) : null}
    </button>
  );
});
