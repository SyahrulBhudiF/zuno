import {
  memo,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/motion/tooltip";
import { CheckActiveIcon, CheckIcon, DislikeActiveIcon, DislikeIcon, DownloadIcon, HeartActiveIcon, HeartIcon, ListIcon, PlaylistAddIcon, PlayActiveIcon } from "@/ui/icons";
import { Loader } from "@/components/motion/loader";
import {
  getOfflineStatus,
  queueDownload,
  removeDownload,
  useOfflineState,
} from "../../player/offlineStore";
import type { Track, TrackRating } from "../../datasource/types";
import { libraryController, useLibraryState } from "../../player/playerStore";
import { useTrackContextMenu } from "./TrackContextMenu";
import { ArtistLinks } from "./ArtistLinks";
import { TrackArtwork } from "./TrackArtwork";

/**
 * Anything else a caller needs on the underlying button — the playlist page attaches
 * pointer handlers and a data attribute here for drag-reorder. `onClick` and `onContextMenu`
 * are owned by this component, so they are excluded to keep one source of truth.
 */
type PassthroughButtonProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "onClick" | "onContextMenu" | "onSelect" | "children" | "className" | "type"
>;

interface TrackRowProps extends PassthroughButtonProps {
  track: Track;
  /** Zero-based; rendered as the 1-based position. */
  index: number;
  /** This is the track the player is on, whether or not it is currently advancing. */
  isCurrent: boolean;
  /** Current *and* actually playing — drives the level meter over the static glyph. */
  isPlaying: boolean;
  onSelect: (event: MouseEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  /** Shows a quick "add to playlist" affordance on hover. Omit to hide it. */
  onQuickAdd?: () => void;
  /** Shows a quick "add to queue" affordance on hover. Omit to hide it. */
  onQuickAddToQueue?: () => void;
  /** Shows a download-for-offline toggle. Omit on rows where it makes no sense. */
  showDownload?: boolean;
  /** Shows like/dislike. Omit where a rating makes no sense, e.g. local-only lists. */
  showRating?: boolean;
  /** Part of a multi-selection. Swaps the index column for a checkbox. */
  isSelected?: boolean;
  /** True while any row in the list is selected, so every row shows its checkbox. */
  isSelectionActive?: boolean;
  onToggleSelected?: () => void;
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
 * Download-for-offline toggle.
 *
 * Unlike the other hover actions this one stays visible once a track is downloaded — that is
 * state you need to see without hovering, the same reasoning as the queue's stop marker.
 */
function DownloadAction({ track }: { track: Track }) {
  // Subscribing here rather than in TrackRow keeps download churn from re-rendering the
  // whole row, which matters on a 500-row playlist while a queue is draining.
  const offline = useOfflineState();
  const status = getOfflineStatus(track.id);
  const isDownloading = status === "downloading";

  if (track.source === "local") return null;

  const label = status === "ready"
    ? `Remove ${track.title} from downloads`
    : `Download ${track.title}`;

  return (
    <Tooltip content={status === "ready" ? "Downloaded — click to remove" : "Download"}>
      <span
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={status === "ready"}
        className={cn(
          "grid shrink-0 place-items-center rounded-full transition",
          // The percent readout needs more room than a glyph, so the slot widens only while
          // it is showing rather than reserving the space on every row forever.
          isDownloading ? "h-8 w-12" : "size-8",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          status === "ready"
            ? "text-primary opacity-100"
            : "text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover/row:opacity-100 focus:opacity-100",
          (status === "queued" || status === "downloading") && "opacity-100",
          status === "failed" && "text-destructive opacity-100",
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (status === "ready") void removeDownload(track.id);
          else queueDownload(track);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          if (status === "ready") void removeDownload(track.id);
          else queueDownload(track);
        }}
      >
        {isDownloading ? (
          /* Fed by the real byte count streamed from Rust. When the response has no
             Content-Length the store reports null and this falls back to the sweeping
             animation, which is honest about not knowing. */
          <Loader
            variant="percent"
            size={18}
            value={offline.progress ?? undefined}
            label={`Downloading ${track.title}`}
          />
        ) : status === "queued" ? (
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
        ) : status === "ready" ? (
          <CheckActiveIcon size={16} aria-hidden="true" />
        ) : (
          <DownloadIcon size={16} aria-hidden="true" />
        )}
      </span>
    </Tooltip>
  );
}

/**
 * A hover action inside the row.
 *
 * A span with role="button" rather than a <button>: the row itself is a button, and nesting
 * one inside another is invalid and gets flattened by the parser. The click must not fall
 * through either, or "add to queue" would also start the song playing.
 */
function QuickAction({
  label,
  tooltip,
  onActivate,
  children,
}: {
  label: string;
  tooltip: string;
  onActivate: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={tooltip}>
      <span
        role="button"
        tabIndex={0}
        aria-label={label}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground",
          "opacity-0 transition hover:bg-background hover:text-foreground",
          "group-hover/row:opacity-100 focus:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onClick={(event) => {
          event.stopPropagation();
          onActivate();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          onActivate();
        }}
      >
        {children}
      </span>
    </Tooltip>
  );
}

/**
 * Like and dislike, as a pair.
 *
 * Shown together rather than as one cycling control: a rating has three states, and a single
 * button that walks like → dislike → none makes the user guess where they are in the cycle.
 * Two buttons say what they will do and which one is active.
 *
 * The active one stays visible when set — hiding a rating until hover would mean you cannot see
 * what you rated without hunting for it — while the inactive one appears on hover like the
 * other row actions.
 */
function RatingActions({ track }: { track: Track }) {
  const { rateTrack } = useTrackContextMenu();
  const libraryState = useLibraryState();

  // Local files have no YouTube rating to set, and a signed-out session has nowhere to put one.
  if (track.source === "local") return null;

  const rating = libraryController.getTrackRating(track.id);
  const isPending = libraryState.pendingLikeTrackIds.has(track.id);

  const button = (target: Exclude<TrackRating, "none">, icon: ReactNode, label: string) => {
    const isActive = rating === target;
    return (
      <Tooltip content={isActive ? `Undo ${label.toLowerCase()}` : label}>
        <span
          role="button"
          tabIndex={0}
          aria-label={isActive ? `Undo ${label.toLowerCase()} for ${track.title}` : `${label} ${track.title}`}
          aria-pressed={isActive}
          aria-busy={isPending}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isPending && "pointer-events-none opacity-50",
            isActive
              ? "text-primary opacity-100"
              : "text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover/row:opacity-100 focus:opacity-100",
          )}
          onClick={(event) => {
            event.stopPropagation();
            // Pressing the active rating clears it, which is the only way back to neutral.
            void rateTrack(track, isActive ? "none" : target);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            void rateTrack(track, isActive ? "none" : target);
          }}
        >
          {icon}
        </span>
      </Tooltip>
    );
  };

  return (
    <span className="flex shrink-0 items-center">
      {button(
        "like",
        rating === "like" ? <HeartActiveIcon size={17} /> : <HeartIcon size={17} />,
        "Like",
      )}
      {button(
        "dislike",
        rating === "dislike" ? <DislikeActiveIcon size={17} /> : <DislikeIcon size={17} />,
        "Dislike",
      )}
    </span>
  );
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
  onQuickAdd,
  onQuickAddToQueue,
  showDownload = false,
  showRating = false,
  isSelected = false,
  isSelectionActive = false,
  onToggleSelected,
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
        isSelected && "bg-primary/10",
        className,
      )}
    >
      {children}

      {/* While a selection is open the index column becomes a checkbox. It replaces the
          number rather than sitting beside it so the row width never changes — a list that
          reflows the moment you select something is unusable for range-selecting. */}
      {isSelectionActive && onToggleSelected ? (
        <span
          role="checkbox"
          aria-checked={isSelected}
          tabIndex={0}
          aria-label={`Select ${track.title}`}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent hover:border-muted-foreground",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelected();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            onToggleSelected();
          }}
        >
          <CheckIcon size={14} aria-hidden="true" />
        </span>
      ) : (
      /* The position number is only useful until you have decided to act on the row, so it
          gives way to a play glyph on hover — and to a level meter once this row is the one
          playing. All three share the slot, so the row never reflows between states. */
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
      )}

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

      {/* Hover actions. The row itself is a <button>, so these cannot be buttons — see
          QuickAction. They sit before `trailing` so durations stay hard against the edge. */}
      {showRating && <RatingActions track={track} />}
      {showDownload && <DownloadAction track={track} />}

      {(onQuickAddToQueue || onQuickAdd) && (
        <span className="flex shrink-0 items-center">
          {onQuickAddToQueue && (
            <QuickAction
              label={`Add ${track.title} to the queue`}
              tooltip="Add to queue"
              onActivate={onQuickAddToQueue}
            >
              <ListIcon size={17} aria-hidden="true" />
            </QuickAction>
          )}
          {onQuickAdd && (
            <QuickAction
              label={`Add ${track.title} to a playlist`}
              tooltip="Add to playlist"
              onActivate={onQuickAdd}
            >
              <PlaylistAddIcon size={17} aria-hidden="true" />
            </QuickAction>
          )}
        </span>
      )}

      {trailing}

      {/* Announced to screen readers only; the meter above is decorative. */}
      {isCurrent ? (
        <span className="sr-only">{isPlaying ? "Now playing" : "Paused"}</span>
      ) : null}
    </button>
  );
});
